import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { reconcileBankBatch } from "@/lib/payments/reconciliation";
import { logAudit } from "@/lib/audit";
import crypto from "node:crypto";

/**
 * G-D148: 은행 거래내역 CSV 업로드 + 자동 매칭.
 *
 * POST /api/admin/bank-statements/import
 *   Content-Type: text/csv (또는 JSON: { rows: [...] })
 *
 * CSV 컬럼(순서 고정): date,counterparty,amount,memo,bank_ref
 *   date: YYYY-MM-DD
 *   amount: 숫자 (음수 가능)
 *   bank_ref: 은행 거래 고유번호 (중복 방지)
 *
 * 흐름:
 *   1. batch_id = UUID 생성
 *   2. 각 행 insert (bank_ref UNIQUE — 중복 row 는 skip)
 *   3. reconcileBankBatch() 자동 매칭
 *   4. 결과 요약 반환
 */
type ParsedRow = {
  statement_date: string;
  counterparty: string | null;
  amount: number;
  memo: string | null;
  bank_ref: string | null;
};

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const ct = req.headers.get("content-type") ?? "";
  let parsed: ParsedRow[] = [];

  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as {
      rows?: Array<Record<string, unknown>>;
    };
    parsed = (body.rows ?? []).map(toRow).filter(isValid);
  } else {
    const text = await req.text();
    parsed = parseCsv(text);
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "유효한 행이 없습니다." },
      { status: 400 }
    );
  }
  if (parsed.length > 5000) {
    return NextResponse.json(
      { error: "한 번에 5000건까지 업로드 가능합니다." },
      { status: 400 }
    );
  }

  const batchId = crypto.randomUUID();
  const supabase = createSupabaseAdminClient();

  const toInsert = parsed.map((r) => ({
    org_id: tenant.id,
    statement_date: r.statement_date,
    counterparty: r.counterparty,
    amount: r.amount,
    memo: r.memo,
    bank_ref: r.bank_ref,
    import_batch_id: batchId,
  }));

  // bank_ref UNIQUE 위반은 개별 처리 → 전체 insert 대신 chunk + upsert on conflict do nothing
  const { error } = await supabase
    .from("bank_statements")
    .upsert(toInsert, { onConflict: "org_id,bank_ref", ignoreDuplicates: true });
  if (error) {
    return NextResponse.json(
      { error: "import 실패", detail: error.message },
      { status: 500 }
    );
  }

  const reconcile = await reconcileBankBatch(supabase, tenant.id, batchId);

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "payment.confirm_income",
    resourceType: "bank_statements",
    resourceId: batchId,
    summary: `은행 거래내역 ${parsed.length}건 import (매칭 ${reconcile.matched}건)`,
    metadata: { batchId, rows: parsed.length, ...reconcile },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    batchId,
    imported: parsed.length,
    ...reconcile,
  });
}

function isValid(r: ParsedRow | null): r is ParsedRow {
  if (!r) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.statement_date)) return false;
  if (!Number.isFinite(r.amount)) return false;
  return true;
}

function toRow(o: Record<string, unknown>): ParsedRow | null {
  const date =
    typeof o.date === "string"
      ? o.date
      : typeof o.statement_date === "string"
        ? o.statement_date
        : "";
  const amountRaw = o.amount ?? o.금액 ?? 0;
  const amount = Number(String(amountRaw).replace(/[,\s]/g, ""));
  return {
    statement_date: date,
    counterparty:
      (typeof o.counterparty === "string" ? o.counterparty : null) ??
      (typeof o.이체인 === "string" ? o.이체인 : null),
    amount,
    memo: typeof o.memo === "string" ? o.memo : null,
    bank_ref:
      (typeof o.bank_ref === "string" ? o.bank_ref : null) ??
      (typeof o.거래번호 === "string" ? o.거래번호 : null),
  };
}

function parseCsv(text: string): ParsedRow[] {
  // RFC 4180 간이 파서 (이미 복잡한 CSV 는 JSON 으로 올릴 것을 권장)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => h === "date" || h === "statement_date");
  const cpIdx = headers.findIndex(
    (h) => h === "counterparty" || h === "이체인"
  );
  const amtIdx = headers.findIndex((h) => h === "amount" || h === "금액");
  const memoIdx = headers.findIndex((h) => h === "memo" || h === "메모");
  const refIdx = headers.findIndex(
    (h) => h === "bank_ref" || h === "거래번호"
  );

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const date = dateIdx >= 0 ? cells[dateIdx] ?? "" : "";
    const amount =
      amtIdx >= 0 ? Number((cells[amtIdx] ?? "").replace(/[,\s]/g, "")) : NaN;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount)) continue;
    rows.push({
      statement_date: date,
      counterparty: cpIdx >= 0 ? (cells[cpIdx] ?? null) : null,
      amount,
      memo: memoIdx >= 0 ? (cells[memoIdx] ?? null) : null,
      bank_ref: refIdx >= 0 ? (cells[refIdx] ?? null) : null,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuote = true;
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells;
}
