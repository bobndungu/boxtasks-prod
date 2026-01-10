import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { MercureConnectionState } from '../lib/hooks/useMercure';

interface ConnectionStatusProps {
  state: MercureConnectionState;
  onReconnect?: () => void;
  className?: string;
}

export function ConnectionStatus({ state, onReconnect, className = '' }: ConnectionStatusProps) {
  const { connected, connecting, error } = state;

  if (connecting) {
    return (
      <div className={`flex items-center text-yellow-600 ${className}`} title="Connecting...">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={onReconnect}
        className={`flex items-center text-red-500 hover:text-red-600 ${className}`}
        title={`Connection error: ${error}. Click to reconnect.`}
      >
        <WifiOff className="h-4 w-4" />
      </button>
    );
  }

  if (connected) {
    return (
      <div className={`flex items-center text-green-500 ${className}`} title="Connected - Real-time updates active">
        <Wifi className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className={`flex items-center text-gray-400 ${className}`} title="Disconnected">
      <WifiOff className="h-4 w-4" />
    </div>
  );
}

export default ConnectionStatus;
