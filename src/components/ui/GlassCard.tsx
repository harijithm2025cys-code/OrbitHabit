import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'cyan' | 'purple' | 'emerald' | 'magenta' | 'none';
  interactive?: boolean;
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  glow = 'none',
  interactive = false,
  className,
  children,
  ...props
}) => {
  const glowClasses = {
    none: '',
    cyan: 'border-neon-cyan/40 shadow-neon-cyan/20',
    purple: 'border-neon-purple/40 shadow-neon-purple/20',
    emerald: 'border-neon-emerald/40 shadow-neon-emerald/20',
    magenta: 'border-neon-magenta/40 shadow-neon-magenta/20'
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-main)'
      }}
      className={twMerge(
        clsx(
          'rounded-3xl p-5 border shadow-glass backdrop-blur-xl transition-all duration-200',
          interactive &&
            'cursor-pointer hover:border-[var(--border-active)] hover:scale-[1.01] active:scale-[0.98]',
          glowClasses[glow],
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
