import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-neon-emerald shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-neon-cyan shrink-0" />
  };

  const borders = {
    success: 'border-neon-emerald/40 shadow-emerald-500/20',
    error: 'border-rose-500/40 shadow-rose-500/20',
    info: 'border-neon-cyan/40 shadow-neon-cyan/20'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      style={{
        backgroundColor: 'var(--modal-bg)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-main)'
      }}
      className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl ${borders[toast.type]}`}
    >
      <div className="flex items-center gap-3">
        {icons[toast.type]}
        <span className="text-sm font-semibold">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--border-subtle)] transition"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
