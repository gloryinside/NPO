import { AlertCircle } from 'lucide-react';
import type { DashboardActions } from '@/lib/donor/dashboard-actions';

interface ActionRequiredBannerProps {
  actions: DashboardActions;
}

interface Item {
  label: string;
  linkLabel: string;
  href: string;
}

function buildItems(actions: DashboardActions): Item[] {
  const items: Item[] = [];
  if (actions.failedPayments > 0) {
    items.push({
      label: `결제 실패 (${actions.failedPayments}건) — 결제수단 확인이 필요합니다`,
      linkLabel: '납입내역 보기',
      href: '/donor/payments?status=failed',
    });
  }
  if (actions.missingRrnReceipts > 0) {
    items.push({
      label: `영수증 미발급 (${actions.missingRrnReceipts}건) — 연말정산 영수증 발급을 위해 주민번호 입력이 필요합니다`,
      linkLabel: '영수증 신청',
      href: '/donor/receipts',
    });
  }
  if (actions.recentAdminChanges > 0) {
    items.push({
      label: `약정 변경 이력 (${actions.recentAdminChanges}건) — 관리자가 최근 30일 내 약정 금액을 변경했습니다`,
      linkLabel: '약정 보기',
      href: '/donor/promises',
    });
  }
  return items;
}

export function ActionRequiredBanner({ actions }: ActionRequiredBannerProps) {
  const items = buildItems(actions);
  if (items.length === 0) return null;

  return (
    <section
      role="region"
      aria-labelledby="action-required-title"
      style={{
        background: 'var(--warning-soft)',
        border: '1px solid var(--warning)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
      }}
    >
      <h2
        id="action-required-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--warning)',
          margin: 0,
        }}
      >
        <AlertCircle size={18} />
        확인이 필요한 내역이 있습니다
      </h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0.75rem 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              fontSize: 14,
              color: 'var(--text)',
            }}
          >
            <span>• {item.label}</span>
            <a
              href={item.href}
              style={{
                flexShrink: 0,
                color: 'var(--warning)',
                fontWeight: 500,
                textDecoration: 'none',
                fontSize: 13,
              }}
            >
              {item.linkLabel} →
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
