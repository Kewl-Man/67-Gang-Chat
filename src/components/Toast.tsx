import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 3800);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-bounce-short select-none max-w-sm bg-[#121726]/95 border-[#28324a]">
      {toast.type === 'success' && (
        <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      )}
      {toast.type === 'error' && (
        <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
      )}
      {toast.type === 'info' && (
        <div className="p-1 rounded-full bg-indigo-500/20 text-indigo-400 shrink-0">
          <Info className="w-5 h-5" />
        </div>
      )}

      <div className="flex-1 text-xs font-semibold text-zinc-100">
        {toast.message}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-zinc-400 hover:text-white rounded-md transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
