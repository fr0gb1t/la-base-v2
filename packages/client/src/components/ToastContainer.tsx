import { Toast, ToastType } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const toastStyles: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-emerald-800',
    icon: '✅',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: '❌',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'ℹ️',
  },
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} border rounded-lg p-4 shadow-lg flex items-start gap-3 animate-in slide-in-from-right`}
          >
            <span className="text-xl flex-shrink-0">{style.icon}</span>
            <div className="flex-1">
              <p className={`font-semibold ${style.text}`}>{toast.message}</p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className={`flex-shrink-0 ${style.text} hover:opacity-70`}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
