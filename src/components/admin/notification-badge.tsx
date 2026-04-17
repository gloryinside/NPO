'use client';

import { useEffect, useState } from 'react';

export function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = () =>
      fetch('/api/admin/notifications/unread-count')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(() => {});

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span
      className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-bold text-white"
      style={{ background: 'var(--negative)' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
