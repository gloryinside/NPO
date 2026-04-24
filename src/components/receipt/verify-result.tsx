interface ReceiptVerifyData {
  receipt_code: string;
  year: number;
  total_amount: number;
  issued_at: string | null;
  status: string;
  member_name_masked: string;
}

interface VerifyResultProps {
  data: ReceiptVerifyData | null;
  code: string;
}

/**
 * SP-4: 영수증 진위 확인 결과 표시.
 *
 * - 유효: 녹색 테두리 + 체크
 * - 취소됨: 빨간 테두리 + X
 * - 찾을 수 없음: 빨간 테두리 + X + 코드 표시
 *
 * 후원자 이름은 "김○○" 형태로 마스킹 — 이 페이지는 공개 링크.
 */
export function VerifyResult({ data, code }: VerifyResultProps) {
  if (!data) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          borderColor: "var(--negative)",
          background: "var(--negative-soft, #fef2f2)",
        }}
      >
        <p className="text-3xl mb-3" aria-hidden="true">
          ❌
        </p>
        <p
          className="text-base font-semibold"
          style={{ color: "var(--negative)" }}
        >
          영수증을 찾을 수 없습니다
        </p>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          코드: <span className="font-mono">{code}</span>
        </p>
      </div>
    );
  }

  const isValid = data.status !== "cancelled";
  const amount = new Intl.NumberFormat("ko-KR").format(data.total_amount);
  const issuedAt = data.issued_at
    ? new Date(data.issued_at).toLocaleDateString("ko-KR")
    : "-";

  return (
    <div
      className="rounded-2xl border p-8"
      style={{
        borderColor: isValid ? "var(--positive)" : "var(--negative)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl" aria-hidden="true">
          {isValid ? "✅" : "❌"}
        </span>
        <div>
          <p
            className="text-lg font-bold"
            style={{
              color: isValid ? "var(--positive)" : "var(--negative)",
            }}
          >
            {isValid ? "유효한 영수증입니다" : "취소된 영수증입니다"}
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            영수증 번호:{" "}
            <span className="font-mono">{data.receipt_code}</span>
          </p>
        </div>
      </div>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt style={{ color: "var(--muted-foreground)" }}>후원자</dt>
          <dd className="font-medium" style={{ color: "var(--text)" }}>
            {data.member_name_masked}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--muted-foreground)" }}>기부 연도</dt>
          <dd className="font-medium" style={{ color: "var(--text)" }}>
            {data.year}년
          </dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--muted-foreground)" }}>기부 금액</dt>
          <dd className="font-medium" style={{ color: "var(--text)" }}>
            {amount}원
          </dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--muted-foreground)" }}>발급일</dt>
          <dd className="font-medium" style={{ color: "var(--text)" }}>
            {issuedAt}
          </dd>
        </div>
      </dl>
    </div>
  );
}
