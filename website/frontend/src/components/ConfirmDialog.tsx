import { useEffect, useRef } from 'react';
import { CloseIcon, AlertCircleIcon } from './Icon';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'primary',
  loading,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const finalConfirmLabel = confirmLabel || confirmText || 'Xác nhận';
  const finalCancelLabel = cancelLabel || cancelText || 'Hủy bỏ';
  const isBusy = Boolean(loading || isLoading);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isBusy) onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={() => !isBusy && onCancel()}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title-row">
            {variant === 'danger' && (
              <span className="dialog-icon-danger" aria-hidden="true">
                <AlertCircleIcon size={22} />
              </span>
            )}
            <h2 id="dialog-title" className="dialog-title">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Đóng hộp thoại"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <p id="dialog-desc" className="dialog-body">
          {message}
        </p>

        <div className="dialog-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            className={`button ${variant === 'danger' ? 'button-danger' : 'button-primary'}`}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Đang xử lý…' : finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
