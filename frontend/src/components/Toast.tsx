import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore, type ToastType } from '../lib/stores/toast';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

const bgColorMap: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
};

const textColorMap: Record<ToastType, string> = {
  success: 'text-green-800',
  error: 'text-red-800',
  warning: 'text-yellow-800',
  info: 'text-blue-800',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right-full duration-300 ${bgColorMap[toast.type]}`}
        >
          <div className="flex-shrink-0">{iconMap[toast.type]}</div>
          <p className={`flex-1 text-sm font-medium ${textColorMap[toast.type]}`}>
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className={`flex-shrink-0 ${textColorMap[toast.type]} hover:opacity-70`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
