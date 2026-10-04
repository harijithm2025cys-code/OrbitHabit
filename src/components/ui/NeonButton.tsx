import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  glow?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  variant = 'primary',
  size = 'md',
  glow = true,
  className,
  children,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-magenta text-white dark:text-space-950 font-bold hover:opacity-95 shadow-neon-cyan',
    secondary:
      'bg-surface-2 hover:bg-surface-hover text-[var(--text-main)] border border-[var(--border-subtle)] shadow-sm',
    outline:
      'bg-transparent border border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/10 font-semibold',
    danger:
      'bg-gradient-to-r from-rose-600 to-red-600 text-white hover:opacity-90 shadow-red-500/20 font-bold',
    ghost:
      'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-subtle)] border-transparent'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5 min-h-[36px]',
    md: 'px-5 py-2.5 text-sm rounded-2xl gap-2 min-h-[44px]',
    lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5 min-h-[52px]',
    icon: 'p-2.5 rounded-2xl min-w-[44px] min-h-[44px] flex items-center justify-center'
  };

  return (
    <button
      className={twMerge(
        clsx(
          'relative inline-flex items-center justify-center font-medium transition-all duration-200 select-none active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          glow && variant === 'primary' && 'hover:shadow-[0_0_25px_var(--accent-cyan)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </button>
  );
};
