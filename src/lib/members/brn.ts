/**
 * 사업자등록번호(BRN) 유효성 검증.
 *
 * 형식: 10자리 숫자 (XXX-XX-XXXXX 형태도 허용 — 하이픈 제거 후 검증)
 * 알고리즘: 국세청 BRN 체크섬
 *   가중치: 1,3,7,1,3,7,1,3,5
 *   합 = (각 자리 × 가중치) + (9번째 자리 × 5 ÷ 10 의 몫)
 *   체크 = (10 - 합 % 10) % 10
 *   체크 == 마지막 자리(10번째) 면 유효
 */
export function normalizeBRN(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export function isValidBRN(input: string): boolean {
  const n = normalizeBRN(input);
  if (n.length !== 10) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(n[i]) * weights[i];
  }
  sum += Math.floor((Number(n[8]) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(n[9]);
}

export function formatBRN(input: string): string {
  const n = normalizeBRN(input);
  if (n.length !== 10) return input;
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
}
