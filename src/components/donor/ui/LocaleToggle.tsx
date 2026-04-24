"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DONOR_LOCALES,
  readDonorLocaleFromDocument,
  type DonorLocale,
} from "@/lib/i18n/donor-client";

const LOCALE_LABEL: Record<DonorLocale, string> = {
  ko: "한국어",
  en: "English",
};

/**
 * G-D44: 헤더/설정에 삽입하는 간단한 locale 토글.
 * 쿠키에 저장 후 router.refresh() 로 서버 컴포넌트를 다시 렌더.
 */
export function LocaleToggle({ align = "end" }: { align?: "start" | "end" }) {
  const router = useRouter();
  const [locale, setLocale] = useState<DonorLocale>("ko");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocale(readDonorLocaleFromDocument());
  }, []);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as DonorLocale;
    setLocale(next);
    setSaving(true);
    try {
      await fetch("/api/donor/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <label
      className="inline-flex items-center gap-1 text-xs"
      style={{
        color: "var(--muted-foreground)",
        opacity: saving ? 0.5 : 1,
        marginInlineStart: align === "start" ? 0 : undefined,
      }}
    >
      <span className="sr-only">언어 / Language</span>
      <select
        value={locale}
        onChange={handleChange}
        disabled={saving}
        aria-label="Language"
        className="rounded-md border bg-transparent px-2 py-1 text-xs"
        style={{
          borderColor: "var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        {DONOR_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABEL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
