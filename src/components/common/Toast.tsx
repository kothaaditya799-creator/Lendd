import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastProps {
  message: string | null;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number; // milliseconds, default 4000
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-bounce-in transition-all">
      <div
        className={`flex items-center justify-between p-4 rounded-2xl shadow-2xl border-2 backdrop-blur-md ${
          isSuccess
            ? 'bg-emerald-900/95 text-white border-emerald-500 shadow-emerald-950/40'
            : isError
            ? 'bg-rose-900/95 text-white border-rose-500 shadow-rose-950/40'
            : 'bg-teal-900/95 text-white border-teal-500 shadow-teal-950/40'
        }`}
      >
        <div className="flex items-center gap-3">
          {isSuccess && <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />}
          {isError && <AlertCircle className="h-6 w-6 text-rose-400 shrink-0" />}
          {!isSuccess && !isError && <CheckCircle2 className="h-6 w-6 text-teal-400 shrink-0" />}
          <p className="text-sm sm:text-base font-bold leading-snug">{message}</p>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 text-white/80 hover:text-white transition-colors shrink-0 ml-2"
          aria-label="Dismiss notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
