"use client";

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";

/**
 * G-D60: donor 포털 공용 액션 버튼.
 * 최소 터치 타겟 44×44 보장 + variant 색상 토큰 통일.
 */
export type DonorActionVariant =
  | "default"
  | "primary"
  | "positive"
  | "warning"
  | "danger"
  | "ghost";

const VARIANT_STYLE: Record<DonorActionVariant, CSSProperties> = {
  default: {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  primary: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
  },
  positive: {
    background: "var(--positive-soft)",
    color: "var(--positive)",
    border: "1px solid var(--positive)",
  },
  warning: {
    background: "var(--warning-soft)",
    color: "var(--warning)",
    border: "1px solid var(--warning)",
  },
  danger: {
    background: "rgba(239,68,68,0.08)",
    color: "var(--negative)",
    border: "1px solid rgba(239,68,68,0.4)",
  },
  ghost: {
    background: "transparent",
    color: "var(--muted-foreground)",
    border: "1px solid transparent",
  },
};

export interface DonorActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DonorActionVariant;
  size?: "sm" | "md";
}

export const DonorActionButton = forwardRef<HTMLButtonElement, DonorActionButtonProps>(
  function DonorActionButton(
    { variant = "default", size = "sm", className = "", style, ...rest },
    ref
  ) {
    const sizeClass =
      size === "md"
        ? "min-h-11 px-4 py-2.5 text-sm"
        : "min-h-11 min-w-11 px-3 py-2 text-xs";
    return (
      <button
        ref={ref}
        type={rest.type ?? "button"}
        className={`inline-flex items-center justify-center rounded-lg font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${sizeClass} ${className}`}
        style={{ ...VARIANT_STYLE[variant], ...style }}
        {...rest}
      />
    );
  }
);
