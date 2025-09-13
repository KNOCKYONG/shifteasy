/**
 * SSE Event Manager for real-time event streaming
 */

export interface SSEClient {
  id: string;
  userId: string;
  tenantId: string;
  controller: ReadableStreamDefaultController;
  lastEventId: number;
  subscriptions: Set<string>;
}

export interface SSEEvent {
  id: number;
  type: string;
  data: any;
  retry?: number;
  timestamp: Date;
}

class SSEEventManager {
  private static instance: SSEEventManager;
  private clients: Map<string, SSEClient> = new Map();
  private eventQueue: Map<string, SSEEvent[]> = new Map();
  private eventIdCounter: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
  }

  static getInstance(): SSEEventManager {
    if (!SSEEventManager.instance) {
      SSEEventManager.instance = new SSEEventManager();
    }
    return SSEEventManager.instance;
  }

  /**
   * Register a new SSE client
   */
  registerClient(client: SSEClient): void {
    this.clients.set(client.id, client);

    // Send any queued events for this user
    const queueKey = `${client.tenantId}:${client.userId}`;
    const queuedEvents = this.eventQueue.get(queueKey) || [];

    for (const event of queuedEvents) {
      if (event.id > client.lastEventId) {
        this.sendEventToClient(client, event);
      }
    }

    // Clear old events from queue
    if (queuedEvents.length > 0) {
      const recentEvents = queuedEvents.filter(
        e => e.id > client.lastEventId
      );
      this.eventQueue.set(queueKey, recentEvents.slice(-100)); // Keep last 100 events
    }
  }

  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Send event to specific user
   */
  sendToUser(tenantId: string, userId: string, type: string, data: any): void {
    const event: SSEEvent = {
      id: ++this.eventIdCounter,
      type,
      data,
      timestamp: new Date(),
    };

    // Queue the event
    const queueKey = `${tenantId}:${userId}`;
    const queue = this.eventQueue.get(queueKey) || [];
    queue.push(event);
    this.eventQueue.set(queueKey, queue.slice(-100)); // Keep last 100 events

    // Send to connected clients
    for (const client of this.clients.values()) {
      if (client.tenantId === tenantId && client.userId === userId) {
        this.sendEventToClient(client, event);
      }
    }
  }

  /**
   * Send event to topic subscribers
   */
  sendToTopic(tenantId: string, topic: string, type: string, data: any): void {
    const event: SSEEvent = {
      id: ++this.eventIdCounter,
      type,
      data,
      timestamp: new Date(),
    };

    // Send to subscribed clients
    for (const client of this.clients.values()) {
      if (client.tenantId === tenantId && client.subscriptions.has(topic)) {
        this.sendEventToClient(client, event);
      }
    }
  }

  /**
   * Broadcast event to all clients in a tenant
   */
  broadcast(tenantId: string, type: string, data: any): void {
    const event: SSEEvent = {
      id: ++this.eventIdCounter,
      type,
      data,
      timestamp: new Date(),
    };

    for (const client of this.clients.values()) {
      if (client.tenantId === tenantId) {
        this.sendEventToClient(client, event);
      }
    }
  }

  /**
   * Subscribe client to a topic
   */
  subscribeTopic(clientId: string, topic: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(topic);
    }
  }

  /**
   * Unsubscribe client from a topic
   */
  unsubscribeTopic(clientId: string, topic: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(topic);
    }
  }

  /**
   * Send event to a specific client
   */
  private sendEventToClient(client: SSEClient, event: SSEEvent): void {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(
        `id: ${event.id}\n` +
        `event: ${event.type}\n` +
        `data: ${JSON.stringify(event.data)}\n` +
        `retry: ${event.retry || 3000}\n\n`
      );

      client.controller.enqueue(data);
      client.lastEventId = event.id;
    } catch (error) {
      // Client disconnected, remove from list
      this.unregisterClient(client.id);
    }
  }

  /**
   * Send heartbeat to keep connections alive
   */
  private sendHeartbeat(): void {
    const heartbeatEvent: SSEEvent = {
      id: 0, // Heartbeat doesn't increment ID
      type: 'heartbeat',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date(),
    };

    for (const client of this.clients.values()) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(`: heartbeat\n\n`);
        client.controller.enqueue(data);
      } catch (error) {
        // Client disconnected
        this.unregisterClient(client.id);
      }
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connected clients count
   */
  getClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by tenant
   */
  getClientsByTenant(tenantId: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      client => client.tenantId === tenantId
    );
  }
}

export const sseManager = SSEEventManager.getInstance();