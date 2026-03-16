import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

/**
 * Toast 提示组件
 * 用于显示短暂的操作反馈
 */
export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  // 挂载时触发动画
  useEffect(() => {
    const enterTimer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(enterTimer);
  }, []);

  // 关闭逻辑：先触发动画，等待动画完成后再卸载
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // 等待 CSS transition 完成后再调用 onClose
      const exitTimer = setTimeout(() => {
        onClose();
      }, 300); // 与 transition duration 一致
      return () => clearTimeout(exitTimer);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // 背景色 - 使用柔和的浅色调，与项目灰色系 UI 保持一致
  const typeStyles: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  // 图标颜色
  const typeIcons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '!',
  };

  return (
    <div
      className={`
        ${typeStyles[type]}
        border rounded-md shadow-md
        px-4 py-2.5
        flex items-center gap-2.5
        text-sm font-medium
        backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
      style={{
        minWidth: '280px',
        maxWidth: '400px',
      }}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/50 text-xs font-bold">
        {typeIcons[type]}
      </span>
      <span className="flex-1 min-w-0 break-words">{message}</span>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onRemove: (id: string) => void;
}

/**
 * Toast 容器组件
 * 管理多个 Toast 的显示
 */
export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
