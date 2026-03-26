import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal — reusable base modal component.
 *
 * Features:
 *  - Portal-rendered into document.body (avoids z-index stacking issues)
 *  - Close on Escape key
 *  - Close on backdrop click
 *  - Body scroll locked while open
 *  - Scrollable content area
 *
 * Props:
 *   open     boolean   Controls visibility
 *   onClose  fn        Called when user dismisses the modal
 *   title    string    Header title text
 *   children ReactNode Modal body content
 *   width    string    Tailwind max-width class (default: 'max-w-2xl')
 */
export default function Modal({ open, onClose, title, children, width = 'max-w-2xl' }) {
  const overlayRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`
          relative bg-white rounded-2xl shadow-2xl
          w-full ${width} max-h-[90vh]
          flex flex-col
          animate-[fadeInUp_0.18s_ease-out]
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2
            id="modal-title"
            className="text-base font-semibold text-gray-900 leading-tight pr-4 truncate"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
