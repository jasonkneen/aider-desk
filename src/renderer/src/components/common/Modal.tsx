import React, { ReactNode } from 'react';
import { HiX } from 'react-icons/hi'; // Using react-icons for the close icon
import { useTranslation } from 'react-i18next';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close on overlay click
    >
      <div
        className={`relative bg-neutral-800 text-neutral-100 rounded-lg shadow-xl p-6 space-y-4 w-full ${sizeClasses[size]} transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-700">
          {title && (
            <h3 id="modal-title" className="text-lg font-semibold">
              {title}
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close') || 'Close modal'}
            className="text-neutral-400 hover:text-neutral-100 focus:outline-none"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-neutral-700 scrollbar-thumb-neutral-500">
          {children}
        </div>
      </div>
      {/* Basic CSS animation for modal appearance */}
      <style jsx global>{`
        @keyframes modal-appear {
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-modal-appear {
          animation: modal-appear 0.3s forwards;
        }
      `}</style>
    </div>
  );
};

export default Modal;
