'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CancelConfirmModal } from './cancel-confirm-modal';

export function PledgeCancelButton({ pledgeId }: { pledgeId: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  async function handleCancel() {
    // SP-3: 중복된 /api/donor/pledges/[id]/cancel 대신 promises PATCH 로 통일
    const res = await fetch(`/api/donor/promises/${pledgeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '해지 실패');
      return;
    }
    setShowModal(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs px-3 py-2"
        style={{ color: 'var(--negative)', border: '1px solid var(--negative)' }}
      >
        해지
      </button>
      {showModal && (
        <CancelConfirmModal
          title="정기후원 해지"
          message="정기후원을 해지하시겠습니까? 다음 회차부터 자동결제가 중단됩니다."
          confirmLabel="해지하기"
          onConfirm={handleCancel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
