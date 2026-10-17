'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type SignaturePadHandle = {
  /** PNG data URL — 서명이 없으면 null */
  toDataUrl: () => string | null;
  clear: () => void;
};

/**
 * 손가락·펜 서명 칸 (태블릿 현장 모금의 출금동의용).
 * 흰 바탕에 검은 선으로 그린다 — 다크 모드에서도 증빙 이미지는 종이처럼 보이게.
 */
const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onChange?: (signed: boolean) => void }>(
  function SignaturePad({ label, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [signed, setSigned] = useState(false);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ratio = window.devicePixelRatio || 1;
      c.width = c.clientWidth * ratio;
      c.height = c.clientHeight * ratio;
      const ctx = c.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111';
    }, []);

    const mark = (v: boolean) => {
      setSigned(v);
      onChange?.(v);
    };

    useImperativeHandle(ref, () => ({
      toDataUrl: () => (signed && canvasRef.current ? canvasRef.current.toDataURL('image/png') : null),
      clear: () => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
        mark(false);
      },
    }));

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="h-40 w-full touch-none rounded-lg border border-[var(--border)]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          if (!signed) mark(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
    );
  },
);

export default SignaturePad;
