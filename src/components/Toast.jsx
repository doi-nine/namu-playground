import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback(({ message, type = 'info', duration = 6000, onDismiss }) => {
    setToast({ message, type, onDismiss });

    const timer = setTimeout(() => {
      setToast(null);
      onDismiss?.();
    }, duration);

    // 이전 타이머 정리를 위해 ref 대신 클로저로 처리
    setToast(prev => {
      if (prev?._timer) clearTimeout(prev._timer);
      return { message, type, onDismiss, _timer: timer };
    });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(prev => {
      if (prev?._timer) clearTimeout(prev._timer);
      prev?.onDismiss?.();
      return null;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          onClick={dismissToast}
          style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: '400px',
            width: 'calc(100% - 32px)',
            padding: '14px 18px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            borderLeft: toast.type === 'warning' ? '4px solid #F59E0B' : '4px solid var(--button-primary)',
            cursor: 'pointer',
            animation: 'toastSlideUp 0.3s ease-out',
            fontSize: '14px',
            lineHeight: '1.5',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>
              {toast.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
