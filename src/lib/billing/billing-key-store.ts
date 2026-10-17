/**
 * 빌링키 저장소 암호화.
 *
 * 토스 규격: 빌링키는 다시 조회할 수 없고, customerKey와 짝이 맞아야 결제된다.
 * 둘 다 DB에 평문이면 DB 유출 = 즉시 결제 가능. 빌링키를 org_secrets와 같은
 * pgcrypto(키 버전 관리)로 암호화해 저장한다.
 *
 * 저장 형식: `enc:` + encryptSecret() 결과. 접두사가 없으면 예전 평문(점진 이전 중).
 */
import { decryptSecret, encryptSecret } from '@/lib/secrets/crypto'

const PREFIX = 'enc:'

export async function sealBillingKey(billingKey: string): Promise<string> {
  return PREFIX + (await encryptSecret(billingKey))
}

/** 저장값 → 토스에 보낼 빌링키. 복호화 실패 시 null(결제하지 않는다) */
export async function openBillingKey(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null
  if (!stored.startsWith(PREFIX)) return stored // 레거시 평문 — scripts/encrypt-billing-keys 로 이전
  return decryptSecret(stored.slice(PREFIX.length))
}

export function isSealed(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX)
}
