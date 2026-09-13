import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { genId } from '../lib/id';

/**
 * 轻量 toast：提示出现在页面上方居中，自动消失，不打断画布操作。
 * 错误与降级文案要求如实、克制（由调用方传入），萌系文案仅限操作/装饰场景。
 */

interface ToastItem {
  id: string;
  text: string;
  kind: 'info' | 'error';
}

interface ToastApi {
  toast(text: string, kind?: ToastItem['kind']): void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const toast = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = genId('t');
    setItems((prev) => [...prev.slice(-3), { id, text, kind }]);
    const timer = window.setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      timers.current.delete(id);
    }, AUTO_DISMISS_MS);
    timers.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((it) => (
          <div key={it.id} className={`toast toast-${it.kind}`}>
            {it.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
