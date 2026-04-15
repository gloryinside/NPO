import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const KPI_CARDS = [
  { title: "총 후원자 수" },
  { title: "이번 달 납입금액" },
  { title: "활성 캠페인" },
  { title: "미납 약정" },
];

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">대시보드</h1>
      <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-8">
        안녕하세요. NPO 후원관리 대시보드입니다.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {KPI_CARDS.map((card) => (
          <Card
            key={card.title}
            className="bg-[var(--surface)] border-[var(--border)]"
          >
            <CardHeader>
              <CardTitle className="text-sm text-[var(--muted-foreground)]">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--text)]">—</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
