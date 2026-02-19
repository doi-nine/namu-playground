import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback(({ message, type = 'info', duration = 6000, onDismiss, onClose }) => {
    setToast(prev => {
      if (prev?._timer) clearTimeout(prev._timer);
      return null;
    });

    const timer = setTimeout(() => {
      setToast(prev => {
        if (prev?._timer) clearTimeout(prev._timer);
        return null;
      });
      // 타이머 만료는 onClose(거절)와 동일 처리
      onClose?.();
    }, duration);

    setToast({ message, type, onDismiss, onClose, _timer: timer });
  }, []);

  // 토스트 본문 클릭 → 액션 (후기 작성 등)
  const handleAction = useCallback(() => {
    setToast(prev => {
      if (prev?._timer) clearTimeout(prev._timer);
      prev?.onDismiss?.();
      return null;
    });
  }, []);

  // X 버튼 클릭 → 거절 (onClose, 모달 안 열림)
  const handleClose = useCallback((e) => {
    e.stopPropagation();
    setToast(prev => {
      if (prev?._timer) clearTimeout(prev._timer);
      prev?.onClose?.();
      return null;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          onClick={handleAction}
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
            <span style={{ flex: 1 }}>{toast.message}</span>
            {/* X 버튼: 거절, 모달 열지 않음 */}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 0 4px',
                fontSize: '16px',
                color: 'var(--text-muted)',
                lineHeight: 1,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="닫기"
            >
              ✕
            </button>
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
