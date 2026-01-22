/**
 * MercureManager - Centralized manager for a single Mercure EventSource connection
 *
 * This manager maintains ONE EventSource connection that subscribes to all topics,
 * preventing multiple connections when different components need different topics.
 */

// Mercure Hub URL - defaults to localhost:3000 for development
const MERCURE_HUB_URL = import.meta.env.VITE_MERCURE_URL || 'http://localhost:3000/.well-known/mercure';

export interface MercureMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
  actorId?: string;
}

type MessageHandler = (message: MercureMessage) => void;

interface TopicSubscription {
  topic: string;
  handlers: Set<MessageHandler>;
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastEventTime: Date | null;
}

type ConnectionStateListener = (state: ConnectionState) => void;

class MercureManagerClass {
  private eventSource: EventSource | null = null;
  private subscriptions: Map<string, TopicSubscription> = new Map();
  private connectionState: ConnectionState = {
    connected: false,
    connecting: false,
    error: null,
    lastEventTime: null,
  };
  private stateListeners: Set<ConnectionStateListener> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private isIntentionalDisconnect = false;

  /**
   * Subscribe to a topic with a message handler
   * Returns an unsubscribe function
   */
  subscribe(topic: string, handler: MessageHandler): () => void {
    let subscription = this.subscriptions.get(topic);

    if (!subscription) {
      subscription = { topic, handlers: new Set() };
      this.subscriptions.set(topic, subscription);
    }

    subscription.handlers.add(handler);

    // If we have an active connection and this is a new topic, we need to reconnect
    // to include the new topic in the subscription
    if (this.eventSource && !this.hasTopicInConnection(topic)) {
      this.reconnect();
    } else if (!this.eventSource && this.subscriptions.size > 0) {
      // No connection but we have subscriptions - connect
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(topic, handler);
    };
  }

  /**
   * Unsubscribe a handler from a topic
   */
  private unsubscribe(topic: string, handler: MessageHandler): void {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) return;

    subscription.handlers.delete(handler);

    // If no more handlers for this topic, remove the subscription
    if (subscription.handlers.size === 0) {
      this.subscriptions.delete(topic);

      // If no more subscriptions at all, disconnect
      if (this.subscriptions.size === 0) {
        this.disconnect();
      } else {
        // Otherwise reconnect without this topic
        this.reconnect();
      }
    }
  }

  /**
   * Check if a topic is included in the current connection
   */
  private hasTopicInConnection(_topic: string): boolean {
    if (!this.eventSource) return false;
    // We can't easily check what topics are subscribed in EventSource,
    // so we'll track this separately if needed
    return true; // For now, assume we need to reconnect for new topics
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    // Immediately notify of current state
    listener(this.connectionState);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.stateListeners.forEach(listener => listener(this.connectionState));
  }

  /**
   * Connect to Mercure hub with all subscribed topics
   */
  private connect(): void {
    if (this.subscriptions.size === 0) {
      return;
    }

    // Don't connect if already connected
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.isIntentionalDisconnect = false;
    this.setConnectionState({ connecting: true, error: null });

    // Build URL with all topics
    const url = new URL(MERCURE_HUB_URL);
    this.subscriptions.forEach((_, topic) => {
      url.searchParams.append('topic', topic);
    });

    try {
      const eventSource = new EventSource(url.toString(), {
        withCredentials: false,
      });

      eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState({
          connected: true,
          connecting: false,
          error: null,
          lastEventTime: new Date(),
        });
        console.log('[MercureManager] Connected with topics:', Array.from(this.subscriptions.keys()));
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MercureMessage;
          this.setConnectionState({ lastEventTime: new Date() });
          this.routeMessage(message);
        } catch (parseError) {
          console.error('[MercureManager] Failed to parse message:', parseError);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        this.eventSource = null;

        if (this.isIntentionalDisconnect) {
          return;
        }

        this.setConnectionState({
          connected: false,
          connecting: false,
          error: 'Connection lost',
        });

        // Attempt reconnection with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
          this.reconnectAttempts++;

          console.log(`[MercureManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

          this.reconnectTimeout = setTimeout(() => {
            if (!this.isIntentionalDisconnect && this.subscriptions.size > 0) {
              this.connect();
            }
          }, delay);
        } else {
          this.setConnectionState({
            error: 'Max reconnection attempts reached',
          });
          console.error('[MercureManager] Max reconnection attempts reached');
        }
      };

      this.eventSource = eventSource;
    } catch (error) {
      this.setConnectionState({
        connecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      });
    }
  }

  /**
   * Route a message to all handlers subscribed to matching topics
   */
  private routeMessage(message: MercureMessage): void {
    // Messages don't include the topic they came from in the payload,
    // so we send to all handlers and let them filter by message type
    this.subscriptions.forEach(subscription => {
      subscription.handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[MercureManager] Handler error:', error);
        }
      });
    });
  }

  /**
   * Disconnect from Mercure hub
   */
  disconnect(): void {
    this.isIntentionalDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setConnectionState({
      connected: false,
      connecting: false,
    });

    console.log('[MercureManager] Disconnected');
  }

  /**
   * Reconnect with updated topics
   */
  private reconnect(): void {
    this.reconnectAttempts = 0;
    this.disconnect();
    this.isIntentionalDisconnect = false;
    this.connect();
  }

  /**
   * Force reconnect (public method)
   */
  forceReconnect(): void {
    this.reconnect();
  }

  /**
   * Get debug info
   */
  getDebugInfo(): { topics: string[]; connected: boolean; reconnectAttempts: number } {
    return {
      topics: Array.from(this.subscriptions.keys()),
      connected: this.connectionState.connected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Export singleton instance
export const MercureManager = new MercureManagerClass();

export default MercureManager;
