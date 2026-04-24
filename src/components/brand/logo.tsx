interface LogoProps {
  /** 출력 높이(px). 기본 28. 너비는 비율(1:1) 유지. */
  height?: number;
  /** 워드마크 색. 기본 currentColor. */
  color?: string;
  className?: string;
}

export function Logo({ height = 28, color, className }: LogoProps) {
  return (
    <svg
      width={height}
      height={height}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Systemever NPOERP"
      className={className}
      style={color ? { color } : undefined}
    >
      <g>
        <path fillRule="evenodd" clipRule="evenodd" d="M20 0.5C9.25 0.5 0.5 9.25 0.5 20C0.5 30.75 9.24 39.5 20 39.5C30.76 39.5 39.49 30.76 39.49 20C39.49 9.24 30.75 0.5 20 0.5ZM20 40C8.97 40 0 31.03 0 20C0 8.97 8.97 0 20 0C31.03 0 40 8.97 40 20C40 31.03 31.03 40 20 40Z" fill="#939597"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M39 6.5C39 8.99 36.98 11 34.5 11C32.02 11 30 8.99 30 6.5C30 4.02 32.01 2 34.5 2C36.99 2 39 4.02 39 6.5Z" fill="#FEFEFE"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M38 6.5C38 8.43 36.43 10 34.5 10C32.57 10 31 8.43 31 6.5C31 4.57 32.57 3 34.5 3C36.43 3 38 4.57 38 6.5Z" fill="#0C8599"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M35 20C35 28.28 28.28 35 20 35C11.72 35 5 28.28 5 20C5 11.72 11.71 5 20 5C28.29 5 35 11.72 35 20Z" fill="#0B7285"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M20 34C12.27 34 6 27.73 6 20C6 12.27 12.27 6 20 6C27.73 6 34 12.27 34 20C34 27.73 27.73 34 20 34Z" fill="#0C8599"/>
      </g>
    </svg>
  );
}
