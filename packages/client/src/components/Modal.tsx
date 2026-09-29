import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClose?: () => void;
}

export function Modal({ isOpen, title, children, footer, size = 'md', onClose }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className={`bg-slate-900 rounded-xl shadow-2xl w-full ${sizeClasses[size]} transform transition-all animate-in fade-in zoom-in-95 border border-slate-700`}>
          {/* Header */}
          <div className="border-b border-slate-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>

          {/* Content */}
          <div className="px-6 py-6 text-slate-100">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-slate-700 px-6 py-4 bg-slate-800 rounded-b-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
