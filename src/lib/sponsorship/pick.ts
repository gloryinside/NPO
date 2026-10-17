/**
 * 결연 아동 선택 신청 — 신청 화면에 보일 아이 정보와 신청 중 잡아 두는 기한.
 *
 * 아이는 관리자가 '신청 화면에 공개'를 켠 경우(보호자 동의)만 보인다. 공개해도 이름은 성만 보이고
 * 정확한 생년 대신 나이, 사는 곳은 광역 단위만 보인다.
 */
import { maskName } from "@/lib/cheer/messages";

export type PublicChild = {
  id: string;
  code: string;
  displayName: string;
  age: number | null;
  gender: string | null;
  region: string | null;
  bio: string | null;
  photoUrl: string | null;
};

type BeneficiaryRow = {
  id: string;
  code: string;
  name: string;
  birth_year: number | null;
  gender: string | null;
  region: string | null;
  bio: string | null;
  photo_url: string | null;
};

const GENDER_LABEL: Record<string, string> = { male: "남자아이", female: "여자아이" };

/** 사진 주소는 https 만 — 관리자가 넣은 값이라도 다른 스킴은 쓰지 않는다 */
function safePhoto(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function toPublicChild(row: BeneficiaryRow, thisYear: number): PublicChild {
  return {
    id: row.id,
    code: row.code,
    displayName: maskName(row.name),
    age: row.birth_year ? Math.max(0, thisYear - row.birth_year) : null,
    gender: row.gender ? GENDER_LABEL[row.gender] ?? null : null,
    // 관리자가 자유롭게 적은 값이라 첫 낱말(광역 단위)만 — '서울 강북구 ○○동' → '서울'
    region: row.region ? row.region.trim().split(/\s+/)[0] ?? null : null,
    bio: row.bio ? row.bio.slice(0, 300) : null,
    photoUrl: safePhoto(row.photo_url),
  };
}

/**
 * 신청이 끝날 때까지 아이를 잡아 두는 기한.
 *  - 카드: 결제창에서 바로 등록하므로 하루
 *  - 자동이체·계좌이체·직접 납부: 출금동의나 첫 입금까지 시간이 걸려 7일
 *    (돈이 오가지 않는 신청이라 길게 잡으면 아이들을 묶어 둘 수 있다 — 보안 검토)
 * 기한이 지나거나 약정이 취소되면(DB 트리거) 다시 다른 후원자가 고를 수 있다.
 */
export function reservationUntil(offline: boolean, now: Date = new Date()): string {
  const days = offline ? 7 : 1;
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

/** 신청 화면에 보일 수 있는 아이 — 공개·결연 가능·잡아 둔 신청이 없거나 기한이 지난 경우 */
export function isPickable(
  row: { status: string; public_listing: boolean; reserved_until: string | null },
  now: Date = new Date(),
): boolean {
  return (
    row.status === "available" &&
    row.public_listing &&
    (!row.reserved_until || new Date(row.reserved_until) < now)
  );
}
