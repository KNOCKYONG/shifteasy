/**
 * Web Push Subscription Manager
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
  tenantId: string;
  topics: string[];
  createdAt: Date;
  expirationTime?: number | null;
}

class PushSubscriptionManager {
  private static instance: PushSubscriptionManager;
  private subscriptions: Map<string, PushSubscriptionData> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map();
  private topicSubscriptions: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): PushSubscriptionManager {
    if (!PushSubscriptionManager.instance) {
      PushSubscriptionManager.instance = new PushSubscriptionManager();
    }
    return PushSubscriptionManager.instance;
  }

  /**
   * Add a push subscription
   */
  addSubscription(data: PushSubscriptionData): string {
    const subscriptionId = this.generateSubscriptionId(data.endpoint);

    // Store subscription
    this.subscriptions.set(subscriptionId, data);

    // Index by user
    const userKey = `${data.tenantId}:${data.userId}`;
    if (!this.userSubscriptions.has(userKey)) {
      this.userSubscriptions.set(userKey, new Set());
    }
    this.userSubscriptions.get(userKey)?.add(subscriptionId);

    // Index by topics
    data.topics.forEach(topic => {
      const topicKey = `${data.tenantId}:${topic}`;
      if (!this.topicSubscriptions.has(topicKey)) {
        this.topicSubscriptions.set(topicKey, new Set());
      }
      this.topicSubscriptions.get(topicKey)?.add(subscriptionId);
    });

    console.log(`Push subscription added: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Remove a push subscription
   */
  removeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove from user index
    const userKey = `${subscription.tenantId}:${subscription.userId}`;
    this.userSubscriptions.get(userKey)?.delete(subscriptionId);

    // Remove from topic index
    subscription.topics.forEach(topic => {
      const topicKey = `${subscription.tenantId}:${topic}`;
      this.topicSubscriptions.get(topicKey)?.delete(subscriptionId);
    });

    // Remove subscription
    this.subscriptions.delete(subscriptionId);
    console.log(`Push subscription removed: ${subscriptionId}`);
  }

  /**
   * Update subscription topics
   */
  updateSubscriptionTopics(subscriptionId: string, newTopics: string[]): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove from old topic indexes
    subscription.topics.forEach(topic => {
      const topicKey = `${subscription.tenantId}:${topic}`;
      this.topicSubscriptions.get(topicKey)?.delete(subscriptionId);
    });

    // Update topics
    subscription.topics = newTopics;

    // Add to new topic indexes
    newTopics.forEach(topic => {
      const topicKey = `${subscription.tenantId}:${topic}`;
      if (!this.topicSubscriptions.has(topicKey)) {
        this.topicSubscriptions.set(topicKey, new Set());
      }
      this.topicSubscriptions.get(topicKey)?.add(subscriptionId);
    });
  }

  /**
   * Get subscriptions for a user
   */
  getUserSubscriptions(tenantId: string, userId: string): PushSubscriptionData[] {
    const userKey = `${tenantId}:${userId}`;
    const subscriptionIds = this.userSubscriptions.get(userKey) || new Set();

    return Array.from(subscriptionIds)
      .map(id => this.subscriptions.get(id))
      .filter((sub): sub is PushSubscriptionData => sub !== undefined);
  }

  /**
   * Get subscriptions for a topic
   */
  getTopicSubscriptions(tenantId: string, topic: string): PushSubscriptionData[] {
    const topicKey = `${tenantId}:${topic}`;
    const subscriptionIds = this.topicSubscriptions.get(topicKey) || new Set();

    return Array.from(subscriptionIds)
      .map(id => this.subscriptions.get(id))
      .filter((sub): sub is PushSubscriptionData => sub !== undefined);
  }

  /**
   * Get all subscriptions for a tenant
   */
  getTenantSubscriptions(tenantId: string): PushSubscriptionData[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.tenantId === tenantId);
  }

  /**
   * Clean up expired subscriptions
   */
  cleanupExpiredSubscriptions(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.expirationTime && subscription.expirationTime < now) {
        this.removeSubscription(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired push subscriptions`);
    }

    return removedCount;
  }

  /**
   * Generate subscription ID from endpoint
   */
  private generateSubscriptionId(endpoint: string): string {
    // Use the last part of the endpoint as ID (usually unique)
    const parts = endpoint.split('/');
    return parts[parts.length - 1] || `sub-${Date.now()}`;
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    totalSubscriptions: number;
    uniqueUsers: number;
    topicCounts: Map<string, number>;
  } {
    const topicCounts = new Map<string, number>();

    for (const [topic, subs] of this.topicSubscriptions.entries()) {
      topicCounts.set(topic, subs.size);
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      uniqueUsers: this.userSubscriptions.size,
      topicCounts,
    };
  }

  /**
   * Export all subscriptions (for backup)
   */
  exportSubscriptions(): PushSubscriptionData[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Import subscriptions (for restore)
   */
  importSubscriptions(data: PushSubscriptionData[]): void {
    data.forEach(subscription => {
      this.addSubscription(subscription);
    });
  }
}

export const pushSubscriptionManager = PushSubscriptionManager.getInstance();