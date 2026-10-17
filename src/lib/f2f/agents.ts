/**
 * 현장 모금(태블릿) 신청 링크 — 모금가마다 링크를 만들고, 그 링크로 받은 신청에 모금가를 붙인다.
 *
 * 링크 = /f2f/<토큰>. 토큰 원문은 만들 때 한 번만 보여 주고 DB에는 sha256 해시만 둔다.
 * 링크가 새면 관리자가 끄면 된다(active=false). 기한이 지나면 저절로 막힌다.
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_LINK_DAYS = 90;

export function newAgentToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashAgentToken(token) };
}

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 토큰 모양 — 32자 base64url. 다른 모양은 DB를 보지 않고 거절 */
export function isTokenShape(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{32}$/.test(v);
}

export type AgentInput = { name: string; code: string; campaignId: string; days: number };

export function parseAgentInput(body: Record<string, unknown>): { ok: true; value: AgentInput } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40) return { ok: false, error: "모금가 이름을 40자 안으로 적어 주세요." };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(code)) return { ok: false, error: "코드는 영문·숫자 2~20자로 적어 주세요." };
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return { ok: false, error: "캠페인을 골라 주세요." };
  const days = Number(body.days ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > MAX_LINK_DAYS) {
    return { ok: false, error: `사용 기간은 1~${MAX_LINK_DAYS}일로 정해 주세요.` };
  }
  return { ok: true, value: { name, code, campaignId, days } };
}

export type ActiveAgent = { id: string; orgId: string; campaignId: string; name: string; code: string };

/** 링크 토큰으로 쓸 수 있는 모금가 — 기관이 맞고, 켜져 있고, 기한 안 */
export async function resolveAgent(supabase: SupabaseClient, orgId: string, token: unknown): Promise<ActiveAgent | null> {
  if (!isTokenShape(token)) return null;
  const { data } = await supabase
    .from("f2f_agents")
    .select("id, org_id, campaign_id, name, code, active, expires_at")
    .eq("token_hash", hashAgentToken(token))
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data || !data.active || new Date(data.expires_at as string) <= new Date()) return null;
  return { id: data.id, orgId: data.org_id, campaignId: data.campaign_id, name: data.name, code: data.code };
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const SIGNATURE_MAX_BYTES = 400_000;

/** 서명 이미지(data:image/png;base64,…)를 PNG 바이트로 — 모양·크기가 다르면 null */
export function decodeSignature(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) return null;
  const b64 = dataUrl.slice("data:image/png;base64,".length);
  if (b64.length > Math.ceil((SIGNATURE_MAX_BYTES * 4) / 3) + 4 || !/^[A-Za-z0-9+/]+=*$/.test(b64)) return null;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 100 || bytes.length > SIGNATURE_MAX_BYTES) return null;
  return bytes.subarray(0, 8).equals(PNG_MAGIC) ? bytes : null;
}

/** 현장 신청 직후에만 서명을 받는다 — 링크가 새도 지난 신청에 서명을 붙이지 못하게 */
export const CONSENT_WINDOW_MS = 60 * 60 * 1000;
