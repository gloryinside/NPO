import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DesignCheckPage() {
  return (
    <main className="p-8 space-y-8 max-w-2xl">
      <section>
        <h1 className="text-2xl font-bold mb-4">Design System Check</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          5색 의미 토큰 + shadcn/ui 컴포넌트 스모크 테스트
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <div className="flex gap-2 flex-wrap">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Badges (상태)</h2>
        <div className="flex gap-2 flex-wrap">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: "var(--positive-soft)", color: "var(--positive)" }}
          >
            납부완료
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}
          >
            대기중
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: "var(--info-soft)", color: "var(--info)" }}
          >
            처리중
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Card</h2>
        <Card>
          <CardHeader>
            <CardTitle>이달 후원금</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1,250,000원</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">지난달 대비 +12%</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Input</h2>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" placeholder="donor@example.com" />
        </div>
      </section>
    </main>
  );
}
