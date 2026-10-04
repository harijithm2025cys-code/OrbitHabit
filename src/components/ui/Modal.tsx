import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const [mounted, setMounted] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        setKeyboardOffset(Math.max(0, offset));
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, [isOpen, onClose]);

  if (!mounted || typeof document === 'undefined' || !isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      {/* Dimmed backdrop covering full screen */}
      <div
        className="fixed inset-0 bg-black/80 z-[9998] cursor-pointer transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Solid Bottom Sheet / Modal */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          bottom: `${keyboardOffset}px`,
          maxHeight: '85dvh',
          backgroundColor: 'var(--modal-bg)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-main)'
        }}
        className="fixed left-0 right-0 z-[9999] w-full max-w-lg mx-auto overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-5 sm:p-6 shadow-[0_-16px_48px_rgba(0,0,0,0.6)] pb-[calc(env(safe-area-inset-bottom,16px)+16px)] sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 transition-all duration-200"
      >
        {/* Mobile Sheet Drag Indicator Bar */}
        <div className="w-12 h-1 bg-[var(--border-subtle)] rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[var(--border-subtle)]">
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] tracking-wide">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-subtle)] transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="text-[var(--text-muted)]">{children}</div>
      </div>
    </div>,
    document.body
  );
};
