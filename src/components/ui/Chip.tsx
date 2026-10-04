import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onClick,
  icon,
  className
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 select-none min-h-[36px]',
          selected
            ? 'bg-gradient-to-r from-neon-cyan/25 to-neon-purple/25 border border-neon-cyan/60 text-[var(--text-main)] shadow-sm'
            : 'bg-surface-2 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-active)]',
          onClick ? 'cursor-pointer active:scale-95' : 'cursor-default',
          className
        )
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
