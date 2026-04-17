'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CancelConfirmModal } from './cancel-confirm-modal';

export function PaymentCancelButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  async function handleCancel() {
    const res = await fetch(`/api/donor/payments/${paymentId}/cancel`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '취소 실패');
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
        취소
      </button>
      {showModal && (
        <CancelConfirmModal
          title="후원 취소"
          message="이 결제를 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          confirmLabel="취소하기"
          onConfirm={handleCancel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
