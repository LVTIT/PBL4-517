import { useEffect } from 'react';
import { Link } from 'react-router';
import { CheckIcon, AlertCircleIcon, CloseIcon } from './Icon';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  actionText?: string;
  actionHref?: string;
}

interface LiveToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function LiveToast({ toast, onDismiss }: LiveToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className="live-toast-wrapper"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`live-toast live-toast-${toast.type}`}>
        <span className="toast-icon" aria-hidden="true">
          {toast.type === 'success' ? (
            <CheckIcon size={18} />
          ) : (
            <AlertCircleIcon size={18} />
          )}
        </span>
        <span className="toast-text">{toast.message}</span>
        {toast.actionHref && toast.actionText && (
          <Link to={toast.actionHref} className="toast-action" onClick={onDismiss}>
            {toast.actionText} →
          </Link>
        )}
        <button
          type="button"
          className="toast-dismiss"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
}
