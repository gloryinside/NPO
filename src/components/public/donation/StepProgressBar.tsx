'use client';

interface StepProgressBarProps {
  steps: string[];
  currentStep: number;
}

export default function StepProgressBar({ steps, currentStep }: StepProgressBarProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        const circleStyle: React.CSSProperties = {
          background: isCompleted || isCurrent ? 'var(--accent)' : 'var(--surface-2)',
          border: isCompleted || isCurrent ? 'none' : '2px solid var(--border)',
          color: isCompleted || isCurrent ? '#fff' : 'var(--muted-foreground)',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '13px',
          fontWeight: 700,
        };

        const labelStyle: React.CSSProperties = {
          color: isCompleted
            ? 'var(--accent)'
            : isCurrent
            ? 'var(--text)'
            : 'var(--muted-foreground)',
          fontSize: '11px',
          marginTop: '4px',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        };

        const lineStyle: React.CSSProperties = {
          flex: 1,
          height: '2px',
          background: isCompleted ? 'var(--accent)' : 'var(--border)',
          marginBottom: '16px',
        };

        return (
          <div key={index} className="flex items-end flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div style={circleStyle}>{isCompleted ? '✓' : index + 1}</div>
              <span style={labelStyle}>{step}</span>
            </div>
            {index < steps.length - 1 && <div style={lineStyle} />}
          </div>
        );
      })}
    </div>
  );
}
