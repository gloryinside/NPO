/**
 * 후원자 ↔ 결연 아동 편지 — 후원자가 마이페이지에서 쓰고, 기관이 검토(필요하면 번역)한 뒤 전달한다.
 * 아이가 보낸 편지는 기관이 '전달됨'으로 바꾼 것만 후원자에게 보인다.
 */

export const LETTER_MIN = 10;
export const LETTER_MAX = 2000;
/** 결연 하나당 하루에 쓸 수 있는 편지 수 */
export const LETTERS_PER_DAY = 3;

export function parseLetterText(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "편지 내용을 적어 주세요." };
  // 줄바꿈·탭은 두고 나머지 제어 문자는 지운다
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim();
  if (text.length < LETTER_MIN) return { ok: false, error: `${LETTER_MIN}자 이상 적어 주세요.` };
  if (text.length > LETTER_MAX) return { ok: false, error: `${LETTER_MAX.toLocaleString("ko-KR")}자까지 쓸 수 있어요.` };
  return { ok: true, text };
}

type LetterRow = {
  id: string;
  direction: "to_beneficiary" | "to_sponsor";
  original_text: string | null;
  translated_text: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  delivered_at: string | null;
};

export type DonorLetter = {
  id: string;
  fromMe: boolean;
  text: string;
  statusLabel: string | null;
  note: string | null;
  date: string;
};

const MY_STATUS: Record<string, string> = {
  received: "기관 확인 중",
  translating: "번역 중",
  reviewed: "전달 준비 중",
  delivered: "전달됨",
  rejected: "전달하지 못함",
};

/** 후원자에게 보여 줄 편지 — 아이 편지는 전달된 것만, 번역본이 있으면 번역본 */
export function toDonorLetters(rows: LetterRow[]): DonorLetter[] {
  return rows.flatMap((r): DonorLetter[] => {
    if (r.direction === "to_sponsor") {
      if (r.status !== "delivered") return [];
      const text = r.translated_text || r.original_text;
      if (!text) return [];
      return [{ id: r.id, fromMe: false, text, statusLabel: null, note: null, date: r.delivered_at ?? r.created_at }];
    }
    return [{
      id: r.id,
      fromMe: true,
      text: r.original_text ?? "",
      statusLabel: MY_STATUS[r.status] ?? r.status,
      note: r.status === "rejected" ? r.rejection_reason : null,
      date: r.created_at,
    }];
  });
}
