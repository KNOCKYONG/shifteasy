/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * SSE Client with automatic reconnection and error handling
 */

export type SSEEventHandler = (event: MessageEvent) => void;
export type SSEErrorHandler = (error: Event) => void;

export interface SSEClientOptions {
  url: string;
  headers?: Record<string, string>;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: SSEErrorHandler;
  onReconnect?: (attempt: number) => void;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, SSEEventHandler[]> = new Map();
  private isConnected = false;
  private lastEventId: string | null = null;

  constructor(private options: SSEClientOptions) {
    this.options = {
      reconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  /**
   * Connect to SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    // Build URL with headers as query params (for SSE)
    const url = new URL(this.options.url, window.location.origin);
    if (this.options.headers) {
      Object.entries(this.options.headers).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Add last event ID if available
    if (this.lastEventId) {
      url.searchParams.append('lastEventId', this.lastEventId);
    }

    this.eventSource = new EventSource(url.toString());

    // Connection opened
    this.eventSource.onopen = () => {
      console.log('SSE connection established');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      this.options.onOpen?.();
    };

    // Connection error
    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.isConnected = false;
      this.options.onError?.(error);

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleConnectionClosed();
      }
    };

    // Default message handler
    this.eventSource.onmessage = (event) => {
      this.lastEventId = event.lastEventId;
      this.handleEvent('message', event);
    };

    // Register custom event handlers
    this.eventHandlers.forEach((handlers, eventType) => {
      if (this.eventSource && eventType !== 'message') {
        this.eventSource.addEventListener(eventType, (event) => {
          this.lastEventId = (event as MessageEvent).lastEventId;
          this.handleEvent(eventType, event as MessageEvent);
        });
      }
    });
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.options.onClose?.();
  }

  /**
   * Add event listener
   */
  on(eventType: string, handler: SSEEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)?.push(handler);

    // If already connected, add listener to existing EventSource
    if (this.eventSource && eventType !== 'message') {
      this.eventSource.addEventListener(eventType, (event) => {
        this.lastEventId = (event as MessageEvent).lastEventId;
        handler(event as MessageEvent);
      });
    }
  }

  /**
   * Remove event listener
   */
  off(eventType: string, handler: SSEEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Send data to server (via separate HTTP request)
   */
  async send(data: any): Promise<Response> {
    const response = await fetch(this.options.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
      },
      body: JSON.stringify(data),
    });

    return response;
  }

  /**
   * Handle incoming events
   */
  private handleEvent(eventType: string, event: MessageEvent): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in SSE event handler for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Handle connection closed
   */
  private handleConnectionClosed(): void {
    this.options.onClose?.();

    if (this.options.reconnect &&
        this.reconnectAttempts < (this.options.maxReconnectAttempts || 10)) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.getReconnectDelay();

    console.log(`Scheduling SSE reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.options.onReconnect?.(this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Calculate reconnect delay with exponential backoff
   */
  private getReconnectDelay(): number {
    const baseDelay = this.options.reconnectDelay || 3000;
    const maxDelay = 60000; // Max 1 minute
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);

    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Check if connected
   */
  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get EventSource state
   */
  getReadyState(): number | null {
    return this.eventSource?.readyState ?? null;
  }
}

/**
 * React Hook for SSE
 */
export function useSSE(options: SSEClientOptions) {
  const clientRef = React.useRef<SSEClient | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [reconnectAttempt, setReconnectAttempt] = React.useState(0);

  React.useEffect(() => {
    const client = new SSEClient({
      ...options,
      onOpen: () => {
        setIsConnected(true);
        setReconnectAttempt(0);
        options.onOpen?.();
      },
      onClose: () => {
        setIsConnected(false);
        options.onClose?.();
      },
      onReconnect: (attempt) => {
        setReconnectAttempt(attempt);
        options.onReconnect?.(attempt);
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    client: clientRef.current,
    isConnected,
    reconnectAttempt,
  };
}

// Import React for the hook
import React from 'react';