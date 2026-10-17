import { insertPromise } from "@/lib/billing/promise-create";
import { sealBillingKey } from "@/lib/billing/billing-key-store";
import { kstParts, kstToday } from "@/lib/billing/kst";
import { checkRrn } from "@/lib/receipt/validation";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextCode } from "@/lib/codes-seq";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { sendOfflineDonationReceived, sendBillingKeyFailedEmail } from "@/lib/email";
import { deleteBillingKey, issueBillingKey } from "@/lib/billing/toss-billing";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/http/body";

/**
 * POST /api/donations/prepare
 *
 * 공개(비로그인) 엔드포인트. Toss 결제 위젯 호출 직전에 호출된다.
 * - 캠페인을 검증하고 (org_id 일치 + status='active')
 * - 후원자를 members 테이블에 upsert 하며
 * - idempotency_key 와 payment_code 를 발급해 pending payments 행을 생성한다.
 *
 * member_code / payment_code 는 DB 카운터(next_code_seq)로 원자 발번한다.
 */
export async function POST(req: NextRequest) {
  // Rate limit: IP 당 분당 10회
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`donations:prepare:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      }
    );
  }

  const tenant = await getTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const {
    campaignId,
    amount,
    memberName,
    memberPhone,
    memberEmail,
    payMethod,
    donationType,
    receiptOptIn,
    residentNo,
    rrnConsent,
    customFields,
    designation,
    idempotencyKey: clientIdempotencyKey,
    cardNumber,
    cardExpirationYear,
    cardExpirationMonth,
    cardPassword,
    customerIdentityNumber,
  } = body as {
    campaignId?: string;
    amount?: number;
    memberName?: string;
    memberPhone?: string;
    memberEmail?: string;
    payMethod?: string;
    donationType?: string;
    receiptOptIn?: boolean;
    residentNo?: string;
    /** 고유식별정보(주민등록번호) 처리 별도 동의 — 개인정보보호법 제24조 */
    rrnConsent?: boolean;
    customFields?: Record<string, unknown>;
    designation?: string;
    idempotencyKey?: string;
    cardNumber?: string;
    cardExpirationYear?: string;
    cardExpirationMonth?: string;
    cardPassword?: string;
    customerIdentityNumber?: string;
  };

  // 오프라인 결제 수단 (계좌이체·CMS는 Toss PG 불필요)
  const isOfflineMethod = payMethod === "transfer" || payMethod === "cms" || payMethod === "manual";

  if (!campaignId || typeof campaignId !== "string") {
    return NextResponse.json(
      { error: "campaignId는 필수입니다." },
      { status: 400 }
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount는 양수여야 합니다." },
      { status: 400 }
    );
  }
  if (!memberName || typeof memberName !== "string" || memberName.trim() === "") {
    return NextResponse.json(
      { error: "후원자 이름은 필수입니다." },
      { status: 400 }
    );
  }

  const phone =
    typeof memberPhone === "string" && memberPhone.trim() !== ""
      ? memberPhone.trim()
      : null;
  const email =
    typeof memberEmail === "string" && memberEmail.trim() !== ""
      ? memberEmail.trim()
      : null;

  const supabase = createSupabaseAdminClient();

  // 1. 캠페인 검증 (테넌트 + active 필수) + 기관 계좌 정보 병렬 조회
  const [
    { data: campaign, error: campaignError },
    { data: orgData, error: orgError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, org_id, title, status, form_settings")
      .eq("id", campaignId)
      .eq("org_id", tenant.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("orgs")
      .select("name, bank_name, bank_account, account_holder")
      .eq("id", tenant.id)
      .maybeSingle(),
  ]);

  if (campaignError) {
    console.error("[donations/prepare] campaign lookup failed:", campaignError.message);
    return NextResponse.json(
      { error: "캠페인 정보를 조회할 수 없습니다." },
      { status: 500 }
    );
  }
  if (orgError) {
    console.error("[donations/prepare] org lookup failed:", orgError.message);
    return NextResponse.json(
      { error: "기관 정보를 조회할 수 없습니다." },
      { status: 500 }
    );
  }
  if (!campaign) {
    return NextResponse.json(
      { error: "유효하지 않은 캠페인입니다." },
      { status: 404 }
    );
  }

  // 1b. 결제수단 서버 사이드 검증 — form_settings.paymentMethods 에 포함돼야 함
  if (payMethod) {
    const fs = campaign.form_settings as { paymentMethods?: string[] } | null;
    const allowedMethods = fs?.paymentMethods ?? [];
    if (allowedMethods.length > 0 && !allowedMethods.includes(payMethod)) {
      return NextResponse.json(
        { error: "허용되지 않은 결제수단입니다." },
        { status: 400 }
      );
    }
  }

  // 1c. 테넌트별 Toss client key 로드 — 오프라인 결제는 Toss 불필요
  let tossClientKey: string | null = null;
  if (!isOfflineMethod) {
    const keys = await getOrgTossKeys(tenant.id);
    tossClientKey = keys.tossClientKey;
    if (!tossClientKey) {
      return NextResponse.json(
        { error: "이 기관은 결제 설정이 되어있지 않습니다." },
        { status: 400 }
      );
    }
  }

  // 2. 기존 member 검색 — phone 우선, 없으면 email 로 매칭
  let memberId: string | null = null;

  if (phone) {
    const { data: byPhone } = await supabase
      .from("members")
      .select("id, email")
      .eq("org_id", tenant.id)
      .eq("phone", phone)
      .maybeSingle();
    if (byPhone?.id) {
      memberId = byPhone.id as string;
      // phone 매칭 성공 시 email이 새로 제공됐고 기존과 다르면 갱신
      if (email && byPhone.email !== email) {
        await supabase
          .from("members")
          .update({ email, updated_at: new Date().toISOString() })
          .eq("id", memberId);
      }
    }
  }

  if (!memberId && email) {
    const { data: byEmail } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", tenant.id)
      .eq("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      memberId = byEmail.id as string;
    }
  }

  // 3. 없으면 새 member 생성
  if (!memberId) {
    const year = new Date().getFullYear();
    let memberCode: string;
    try {
      memberCode = await nextCode(supabase, tenant.id, "member", year);
    } catch (e) {
      console.error("[donations/prepare] member code:", (e as Error).message);
      return NextResponse.json(
        { error: "후원자 정보 조회 실패" },
        { status: 500 }
      );
    }

    const { data: newMember, error: memberInsertError } = await supabase
      .from("members")
      .insert({
        org_id: tenant.id,
        member_code: memberCode,
        name: memberName.trim(),
        phone,
        email,
      })
      .select("id")
      .single();

    if (memberInsertError || !newMember) {
      console.error("[donations/prepare] member insert:", memberInsertError?.message);
      return NextResponse.json(
        { error: "후원자 생성 실패" },
        { status: 500 }
      );
    }
    memberId = newMember.id as string;
  }

  // 4. payment_code 생성 (기관·연도 카운터 — 동시 요청에도 중복 없음)
  const year = new Date().getFullYear();
  let paymentCode: string;
  try {
    paymentCode = await nextCode(supabase, tenant.id, "payment", year);
  } catch (e) {
    console.error("[donations/prepare] payment code:", (e as Error).message);
    return NextResponse.json(
      { error: "결제 정보 조회 실패" },
      { status: 500 }
    );
  }
  // Use client-supplied idempotency key if provided (wizard sends one), otherwise generate
  const idempotencyKey =
    typeof clientIdempotencyKey === "string" && clientIdempotencyKey.trim()
      ? clientIdempotencyKey.trim()
      : randomUUID();
  const nowIso = new Date().toISOString();
  // KST 날짜 — UTC로 자르면 1/1 00~09시 후원이 전년도 영수증으로 넘어간다
  const payDate = kstToday();

  // 5a. RRN 암호화 (기부금 영수증 신청 시)
  // pgp_sym_encrypt를 DB RPC로 호출해 BYTEA 값을 미리 계산한다.
  // 암호화 키는 RECEIPTS_ENCRYPTION_KEY 환경변수에서 로드.
  let rrnPendingEncrypted: string | null = null; // base64 or null
  const wantsReceipt = receiptOptIn === true;
  const rawRrn = typeof residentNo === "string" ? residentNo.replace(/-/g, "").trim() : "";
  if (wantsReceipt && rawRrn) {
    // 별도 동의 없이는 받지 않는다(고유식별정보 처리 동의는 다른 동의와 분리해야 한다)
    if (rrnConsent !== true) {
      return NextResponse.json(
        { error: "주민등록번호 수집·이용(고유식별정보 처리)에 동의해 주세요." },
        { status: 400 }
      );
    }
    // 형식·생년월일·성별 자리 검증(2020-10 이후 번호는 체크섬이 없어 체크섬은 보지 않는다)
    const rrnCheck = checkRrn(rawRrn);
    if (!rrnCheck.ok) {
      return NextResponse.json(
        { error: rrnCheck.reason === "format" ? "주민등록번호는 13자리 숫자여야 합니다." : "주민등록번호를 다시 확인해 주세요." },
        { status: 400 }
      );
    }
    const encKey = process.env.RECEIPTS_ENCRYPTION_KEY;
    if (!encKey) {
      return NextResponse.json(
        { error: "영수증 암호화 설정이 누락되었습니다. 관리자에게 문의하세요." },
        { status: 500 }
      );
    }
    const { data: encData, error: encError } = await supabase.rpc(
      "encrypt_rrn_pending",
      { plaintext: rawRrn, passphrase: encKey }
    );
    if (encError) {
      return NextResponse.json(
        { error: "RRN 암호화 실패: " + encError.message },
        { status: 500 }
      );
    }
    rrnPendingEncrypted = encData as string | null;
  }

  // 5b. pending payments 행 생성
  const { data: payment, error: paymentInsertError } = await supabase
    .from("payments")
    .insert({
      org_id: tenant.id,
      payment_code: paymentCode,
      member_id: memberId,
      campaign_id: campaign.id,
      amount,
      pay_date: payDate,
      pay_status: "pending",
      income_status: "pending",
      idempotency_key: idempotencyKey,
      requested_at: nowIso,
      receipt_opt_in: wantsReceipt,
      ...(rrnPendingEncrypted ? { rrn_pending_encrypted: rrnPendingEncrypted, rrn_consent_at: new Date().toISOString() } : {}),
      ...(payMethod ? { pay_method: payMethod } : {}),
      ...(customFields ? { custom_fields: customFields } : {}),
      ...(designation ? { designation } : {}),
      ...(typeof body.utmSource === "string" ? { utm_source: body.utmSource } : {}),
      ...(typeof body.utmMedium === "string" ? { utm_medium: body.utmMedium } : {}),
      ...(typeof body.utmCampaign === "string" ? { utm_campaign: body.utmCampaign } : {}),
      ...(typeof body.utmContent === "string" ? { utm_content: body.utmContent } : {}),
      ...(typeof body.utmTerm === "string" ? { utm_term: body.utmTerm } : {}),
      ...(typeof body.referrer === "string" ? { referrer: String(body.referrer).slice(0, 500) } : {}),
      ...(typeof body.landingUrl === "string" ? { landing_url: String(body.landingUrl).slice(0, 500) } : {}),
    })
    .select("id, payment_code, amount, idempotency_key")
    .single();

  if (paymentInsertError || !payment) {
    console.error("[donations/prepare] payment insert:", paymentInsertError?.message);
    return NextResponse.json(
      { error: "결제 준비 실패" },
      { status: 500 }
    );
  }

  // 6. 정기후원: 빌링키 발급 + promise 생성
  const isRegular = donationType === 'regular';
  let regularBillingKeyFailed = false;
  // [표준] 결제창 카드 등록 — 카드번호가 오지 않은 카드 정기후원은 토스 결제창(requestBillingAuth)으로
  // 카드를 등록한다. 카드 정보가 우리 서버를 거치지 않는다. 키인(카드번호 직접 전송)은 하위 호환으로만.
  let billingAuth: { customerKey: string; promiseId: string } | null = null;

  if (isRegular && memberId) {
    const todayDay = kstParts().day; // KST 기준(서버 UTC와 무관)
    const customerKey = randomUUID();
    let billingKey: string | null = null;
    const sdkBilling = (payMethod ?? 'card') === 'card' && !cardNumber;

    // 카드 정보가 있으면 빌링키 발급 시도
    if (cardNumber && cardExpirationYear && cardExpirationMonth && cardPassword && customerIdentityNumber) {
      const keys = await getOrgTossKeys(tenant.id);
      if (keys.tossSecretKey) {
        const result = await issueBillingKey(keys.tossSecretKey, customerKey, {
          cardNumber,
          cardExpirationYear,
          cardExpirationMonth,
          cardPassword,
          customerIdentityNumber,
        });
        if (result.success) {
          billingKey = result.billingKey;
        } else {
          console.warn('[donations/prepare] 빌링키 발급 실패:', result.error);
          regularBillingKeyFailed = true;
          // 카드 등록 실패 즉시 후원자에게 이메일 알림 (fire-and-forget)
          if (email) {
            const org = orgData as { name?: string } | null;
            sendBillingKeyFailedEmail({
              orgId: tenant.id,
              to: email,
              memberName: (memberName as string | undefined)?.trim() ?? '후원자',
              orgName: org?.name ?? tenant.name,
            });
          }
        }
      }
    }

    // billingKey 발급 실패 시 promise는 pending_billing 상태로 생성 —
    // active로 두면 processMonthlyCharges가 null billingKey로 청구를 시도해 매월 실패함.
    // pending_billing 상태는 관리자가 카드 재등록 후 active로 전환.
    // 빌링키는 암호화해 저장(DB 유출 = 즉시 결제 가능 방지)
    const created = await insertPromise(supabase, tenant.id, {
      member_id: memberId,
      campaign_id: campaign.id,
      type: 'regular',
      amount,
      pay_day: Math.min(todayDay, 28),
      pay_method: payMethod ?? 'card',
      status: billingKey ? 'active' : 'pending_billing',
      toss_billing_key: billingKey ? await sealBillingKey(billingKey) : null,
      // 결제창 방식은 등록 완료 콜백에서 같은 customerKey로 빌링키를 발급하므로 미리 저장
      customer_key: billingKey || sdkBilling ? customerKey : null,
    });
    if ('error' in created) {
      // 약정 저장 실패 — 방금 발급한 빌링키를 토스에서 지워 고아 키를 남기지 않는다
      console.error('[donations/prepare] promise insert:', created.error);
      if (billingKey) {
        const keys = await getOrgTossKeys(tenant.id);
        if (keys.tossSecretKey) await deleteBillingKey(keys.tossSecretKey, billingKey);
      }
      return NextResponse.json({ error: '정기후원 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    if (sdkBilling) billingAuth = { customerKey, promiseId: created.id };
  }

  // 오프라인 결제: Toss 리디렉션 없이 계좌 안내 정보 반환
  if (isOfflineMethod) {
    const org = orgData as {
      name?: string;
      bank_name?: string | null;
      bank_account?: string | null;
      account_holder?: string | null;
    } | null;
    const bankName = org?.bank_name ?? null;
    const bankAccount = org?.bank_account ?? null;
    const accountHolder = org?.account_holder ?? null;

    // 접수 확인 이메일 (fire-and-forget)
    if (email) {
      sendOfflineDonationReceived({
        orgId: tenant.id,
        to: email,
        memberName: memberName.trim(),
        orgName: org?.name ?? tenant.name,
        campaignTitle: campaign.title,
        amount,
        paymentCode: payment.payment_code,
        payMethod: (payMethod as "transfer" | "cms" | "manual") ?? "transfer",
        donationType: (donationType as "onetime" | "regular") ?? "onetime",
        bankName,
        bankAccount,
        accountHolder,
      });
    }

    return NextResponse.json({
      offline: true,
      payMethod: payMethod ?? "transfer",
      donationType: donationType ?? "onetime",
      paymentId: payment.id,
      paymentCode: payment.payment_code,
      amount: payment.amount,
      orderName: campaign.title,
      memberName: memberName.trim(),
      bankName,
      bankAccount,
      accountHolder,
    });
  }

  return NextResponse.json({
    orderId: payment.idempotency_key,
    paymentId: payment.id,
    paymentCode: payment.payment_code,
    amount: payment.amount,
    memberName: memberName.trim(),
    customerName: memberName.trim(),
    customerEmail: email,
    memberEmail: email,
    orderName: campaign.title,
    tossClientKey,
    ...(regularBillingKeyFailed ? { billingKeyFailed: true } : {}),
    ...(billingAuth ? { billingAuth } : {}),
  });
}
