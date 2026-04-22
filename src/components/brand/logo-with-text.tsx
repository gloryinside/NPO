import { Logo } from './logo';

interface LogoWithTextProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'header' | 'footer' | 'compact';
  className?: string;
}

const LOGO_HEIGHT: Record<NonNullable<LogoWithTextProps['size']>, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

const TEXT_SIZE_PX: Record<NonNullable<LogoWithTextProps['size']>, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function LogoWithText({
  size = 'md',
  variant = 'header',
  className,
}: LogoWithTextProps) {
  const logoHeight = LOGO_HEIGHT[size];
  const textSize = TEXT_SIZE_PX[size];

  if (variant === 'compact') {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <Logo height={logoHeight} />
      </span>
    );
  }

  const showPowered = variant === 'footer';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: textSize,
        fontWeight: 600,
      }}
    >
      {showPowered && (
        <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>
          Powered by
        </span>
      )}
      <Logo height={logoHeight} />
      <span>에버후원금관리</span>
    </span>
  );
}
