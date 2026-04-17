'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CancelConfirmModal } from './cancel-confirm-modal';

export function PledgeCancelButton({ pledgeId }: { pledgeId: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  async function handleCancel() {
    const res = await fetch(`/api/donor/pledges/${pledgeId}/cancel`, { method: 'PATCH' });
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
        onClick={() => setShowModal(true)}
        className="text-xs px-2 py-1 rounded"
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
