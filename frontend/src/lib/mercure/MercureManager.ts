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
  private connectedTopics: Set<string> = new Set();
  private connectionState: ConnectionState = {
    connected: false,
    connecting: false,
    error: null,
    lastEventTime: null,
  };
  private stateListeners: Set<ConnectionStateListener> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingConnect: ReturnType<typeof setTimeout> | null = null;
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

    // Schedule a connection sync on next microtask to batch multiple
    // subscribe/unsubscribe calls from the same React render cycle
    this.scheduleConnectionSync();

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
    }

    // Debounce the connection change - don't reconnect immediately.
    // This prevents race conditions when React useEffect cleanup/re-run
    // cycles unsubscribe and immediately resubscribe the same topic.
    this.scheduleConnectionSync();
  }

  /**
   * Schedule a connection sync on next microtask.
   * Batches multiple subscribe/unsubscribe calls from the same render cycle.
   */
  private scheduleConnectionSync(): void {
    if (this.pendingConnect) return;

    this.pendingConnect = setTimeout(() => {
      this.pendingConnect = null;
      this.syncConnection();
    }, 0);
  }

  /**
   * Sync the EventSource connection to match current subscriptions.
   * Creates, reconnects, or disconnects as needed.
   */
  private syncConnection(): void {
    // No subscriptions - disconnect if connected
    if (this.subscriptions.size === 0) {
      if (this.eventSource) {
        this.disconnect();
      }
      return;
    }

    // Check if current connection matches desired topics
    if (this.eventSource) {
      const desiredTopics = new Set(this.subscriptions.keys());
      const topicsMatch =
        this.connectedTopics.size === desiredTopics.size &&
        Array.from(desiredTopics).every(t => this.connectedTopics.has(t));

      if (!topicsMatch) {
        this.reconnect();
      }
    } else {
      this.connect();
    }
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

    // Build URL with all topics and track what we're connecting with
    const url = new URL(MERCURE_HUB_URL);
    this.connectedTopics = new Set(this.subscriptions.keys());
    this.connectedTopics.forEach(topic => {
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

    if (this.pendingConnect) {
      clearTimeout(this.pendingConnect);
      this.pendingConnect = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectedTopics.clear();
    this.setConnectionState({
      connected: false,
      connecting: false,
    });

    console.log('[MercureManager] Disconnected');
  }

  /**
   * Reconnect with updated topics.
   * Closes old connection without triggering state listeners to avoid
   * React re-render cascades that could cause useEffect cleanup races.
   */
  private reconnect(): void {
    this.reconnectAttempts = 0;

    // Close existing connection silently (no state notification)
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.isIntentionalDisconnect = true;
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectedTopics.clear();
    this.isIntentionalDisconnect = false;

    // Connect with current subscriptions
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
