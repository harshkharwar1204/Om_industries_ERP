'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Icon } from './Icon';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; msg: string; type: ToastType; }
type AddToast = (msg: string, type?: ToastType) => void;

const ToastCtx = createContext<AddToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const iconName = (t: ToastType) => t === 'success' ? 'check-circle' : t === 'error' ? 'x-circle' : 'alert-circle';

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert" aria-live="polite">
            <Icon name={iconName(t.type)} size={18} color="#fff" style={{ flexShrink: 0 }} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }
