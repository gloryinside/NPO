/**
 * 주소 검색 연결 자리 — 외부 서비스(예: 카카오 우편번호)는 나중에 provider로 등록한다.
 *
 * 등록된 provider가 없으면 신청서는 "주소 검색" 버튼을 숨기고 직접 입력만 받는다.
 * provider는 브라우저에서 검색 창을 열고, 고른 결과를 돌려준다(취소하면 null).
 */
export type AddressResult = { postalCode: string; address: string };

export type AddressSearchProvider = {
  /** 화면에 보이지 않는 식별용 이름 */
  name: string;
  open(): Promise<AddressResult | null>;
};

let provider: AddressSearchProvider | null = null;

export function registerAddressSearch(p: AddressSearchProvider | null): void {
  provider = p;
}

export function getAddressSearch(): AddressSearchProvider | null {
  return provider;
}
