import React from 'react';
import { motion } from 'framer-motion';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id
}) => {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between group select-none gap-4 cursor-pointer py-1 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {(label || description) && (
        <div className="flex-1">
          {label && <div className="text-sm font-medium text-[var(--text-main)]">{label}</div>}
          {description && <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>}
        </div>
      )}
      <div className="relative flex items-center justify-center min-w-[48px] min-h-[48px]">
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
            checked ? 'bg-neon-cyan/90 shadow-[0_0_12px_var(--accent-cyan)]' : 'bg-surface-2 border border-[var(--border-subtle)]'
          }`}
        >
          <motion.span
            animate={{ x: checked ? 22 : 3 }}
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`inline-block h-5 w-5 rounded-full shadow-md transform pointer-events-none ${
              checked ? 'bg-white' : 'bg-[var(--text-dim)]'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
