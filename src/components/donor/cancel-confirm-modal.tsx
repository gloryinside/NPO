'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/layer';
import { Button } from '@/components/ui/button';

interface CancelConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * 되돌릴 수 없는 취소·해지의 마지막 확인.
 * 포커스 가두기·Esc·바깥 클릭 닫기·포커스 복귀는 공용 Modal(base-ui Dialog)이 맡는다.
 * 호출하는 쪽이 띄울 때만 마운트하므로 항상 열린 상태로 그린다.
 */
export function CancelConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: CancelConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  // 요청이 진행 중일 때는 Esc·바깥 클릭으로 닫히지 않게 한다 — 결과를 못 보고 창이 사라지지 않도록.
  function handleClose() {
    if (!loading) onClose();
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            그대로 두기
          </Button>
          <Button variant="destructive" onClick={handleConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[var(--muted-foreground)]">{message}</p>
    </Modal>
  );
}
