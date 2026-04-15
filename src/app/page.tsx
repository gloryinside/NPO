import { getTenant } from "@/lib/tenant/context";

export default async function HomePage() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <main className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Supporters 플랫폼</h1>
        <p className="text-[var(--muted-foreground)] mb-2">
          서브도메인으로 접근하세요.
        </p>
        <ul className="space-y-1 text-sm">
          <li>
            <a
              href="http://demo.localhost:3000"
              className="text-[var(--accent)] hover:underline"
            >
              demo.localhost:3000
            </a>
            {" "}— 데모 복지재단
          </li>
          <li>
            <a
              href="http://hope.localhost:3000"
              className="text-[var(--accent)] hover:underline"
            >
              hope.localhost:3000
            </a>
            {" "}— 희망 어린이재단
          </li>
        </ul>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">{tenant.name}</h1>
      <p className="text-[var(--muted-foreground)]">slug: {tenant.slug}</p>
      <p className="text-[var(--muted-foreground)]">id: {tenant.id}</p>
      <p className="text-[var(--muted-foreground)]">status: {tenant.status}</p>
    </main>
  );
}
