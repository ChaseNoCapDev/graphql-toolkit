# GraphQL Subscriptions Guide

Comprehensive guide to implementing real-time GraphQL subscriptions using Mercurius and the metaGOTHIC graphql-toolkit.

## Table of Contents

- [Overview](#overview)
- [Basic Subscription Patterns](#basic-subscription-patterns)
- [Advanced Filtering](#advanced-filtering)
- [Connection Management](#connection-management)
- [Authentication & Authorization](#authentication--authorization)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Real-World Examples](#real-world-examples)

---

## Overview

GraphQL subscriptions provide real-time data updates to clients over WebSocket connections. The metaGOTHIC graphql-toolkit provides a comprehensive subscription management system built on Mercurius.

### Why Subscriptions?

- **Real-time Updates**: Push data to clients instantly when events occur
- **Reduced Polling**: Eliminate wasteful polling requests
- **Efficient Resources**: WebSocket connections are more efficient than repeated HTTP requests
- **Better UX**: Provide immediate feedback to users

### Architecture

```
Client (WebSocket) ←→ Gateway ←→ Subscription Manager
                                        ↓
                                   Event Source
                                   (PubSub, DB, etc.)
```

**Components**:
- **ISubscriptionManager**: Core subscription lifecycle management
- **IWebSocketManager**: WebSocket connection handling
- **ISubscriptionAuth**: Authentication and authorization
- **ISubscriptionMiddleware**: Lifecycle hooks and interceptors

---

## Basic Subscription Patterns

### 1. Simple Event Subscription

Subscribe to a stream of events without filtering:

```typescript
import { ISubscriptionManager, GRAPHQL_TOOLKIT_TYPES } from '@chasenocap/graphql-toolkit';

const subscriptionManager = container.get<ISubscriptionManager>(
  GRAPHQL_TOOLKIT_TYPES.ISubscriptionManager
);

// Define subscription resolver
const notificationSubscription = {
  subscribe: async (parent, args, context, info) => {
    return {
      async *[Symbol.asyncIterator]() {
        // Yield events as they occur
        while (true) {
          const event = await getNextNotification();
          yield {
            data: event,
            metadata: {
              timestamp: new Date(),
              source: 'notification-service'
            }
          };
        }
      }
    };
  }
};

// Register subscription
await subscriptionManager.subscribe(
  'notificationReceived',
  notificationSubscription
);
```

### 2. Parameterized Subscription

Accept arguments to customize subscription behavior:

```typescript
const userActivitySubscription = {
  subscribe: async (parent, args, context, info) => {
    const { userId } = args;

    return {
      async *[Symbol.asyncIterator]() {
        // Subscribe to user-specific activity
        const stream = await getUserActivityStream(userId);
        for await (const activity of stream) {
          yield {
            data: activity,
            metadata: {
              timestamp: new Date(),
              source: 'activity-tracker',
              correlationId: activity.id
            }
          };
        }
      }
    };
  },
  // Optional: transform payload before sending
  resolve: (payload) => {
    return {
      ...payload.data,
      receivedAt: payload.metadata?.timestamp
    };
  }
};
```

### 3. Publishing Events

Publish events to subscribers:

```typescript
// Publish to all subscribers of a topic
const subscriberCount = await subscriptionManager.publish('notificationReceived', {
  data: {
    id: '123',
    type: 'NEW_MESSAGE',
    message: 'You have a new message'
  },
  metadata: {
    timestamp: new Date(),
    source: 'message-service',
    version: '1.0'
  }
});

console.log(`Notified ${subscriberCount} subscribers`);
```

---

## Advanced Filtering

### 1. Subscription-Level Filtering

Filter events before they reach subscribers:

```typescript
const orderUpdatesSubscription = {
  subscribe: async (parent, args, context, info) => {
    const { customerId, status } = args;

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getOrderUpdateStream();
        for await (const order of stream) {
          yield {
            data: order,
            metadata: {
              timestamp: new Date(),
              source: 'order-service'
            }
          };
        }
      }
    };
  },
  // Filter function determines which events reach this subscriber
  filter: (payload, variables, context) => {
    const { customerId, status } = variables;
    const order = payload.data;

    // Only send if customer ID matches
    if (customerId && order.customerId !== customerId) {
      return false;
    }

    // Only send if status matches (if specified)
    if (status && order.status !== status) {
      return false;
    }

    return true;
  }
};
```

### 2. Dynamic Filtering

Implement complex filtering logic:

```typescript
const repoEventSubscription = {
  subscribe: async (parent, args, context, info) => {
    const { owner, repo, eventTypes } = args;

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getGitHubEventStream(owner, repo);
        for await (const event of stream) {
          yield {
            data: event,
            metadata: {
              timestamp: new Date(),
              source: 'github-service',
              correlationId: event.id
            }
          };
        }
      }
    };
  },
  filter: (payload, variables, context) => {
    const { eventTypes, branches } = variables;
    const event = payload.data;

    // Filter by event type
    if (eventTypes && !eventTypes.includes(event.type)) {
      return false;
    }

    // Filter by branch (for push events)
    if (event.type === 'push' && branches) {
      const branch = event.ref.replace('refs/heads/', '');
      if (!branches.includes(branch)) {
        return false;
      }
    }

    // Check user permissions
    if (!hasPermission(context.user, event.repo)) {
      return false;
    }

    return true;
  }
};
```

### 3. Targeted Publishing

Publish to specific subscribers using filters:

```typescript
// Publish only to subscribers matching filter criteria
const count = await subscriptionManager.publishToSubscribers(
  'orderUpdates',
  {
    data: updatedOrder,
    metadata: {
      timestamp: new Date(),
      source: 'order-service'
    }
  },
  // Custom filter for this publication
  (payload, variables, context) => {
    // Only send to VIP customers
    return context.user?.isVIP === true;
  }
);

console.log(`Notified ${count} VIP customers`);
```

---

## Connection Management

### 1. Connection Lifecycle

Monitor and manage WebSocket connections:

```typescript
// Get all active connections
const connections = subscriptionManager.getConnections();
connections.forEach((conn) => {
  console.log(`Connection ${conn.id}:`, {
    userId: conn.userId,
    uptime: Date.now() - conn.startTime.getTime(),
    subscriptions: conn.subscriptions.size,
    lastActivity: conn.lastActivity
  });
});

// Get specific connection
const connection = subscriptionManager.getConnection('conn-123');
if (connection) {
  console.log('Active subscriptions:', Array.from(connection.subscriptions));
}

// Close stale connections
const now = Date.now();
connections.forEach(async (conn) => {
  const inactiveTime = now - conn.lastActivity.getTime();
  if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
    console.log(`Closing stale connection ${conn.id}`);
    await subscriptionManager.closeConnection(conn.id);
  }
});
```

### 2. Connection Limits

Configure connection limits and buffering:

```typescript
const subscriptionOptions = {
  maxConnections: 10000,        // Maximum concurrent connections
  bufferSize: 100,              // Message buffer per connection
  keepAlive: true,              // Send keep-alive pings
  keepAliveInterval: 30000,     // Ping every 30 seconds
  connectionTimeout: 300000,    // 5 minute connection timeout
  enableCompression: true,      // Enable WebSocket compression
  enableBatching: false         // Batch multiple messages
};

await subscriptionManager.subscribe(
  'highVolumeUpdates',
  subscriptionResolver,
  subscriptionOptions
);
```

### 3. Health Monitoring

Monitor subscription system health:

```typescript
// Check overall health
const health = await subscriptionManager.healthCheck();
console.log('Subscription system health:', {
  healthy: health.healthy,
  connections: health.connections,
  memoryUsage: `${(health.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
  averageLatency: `${health.latency}ms`,
  errors: health.errors,
  warnings: health.warnings
});

// Get performance statistics
const stats = subscriptionManager.getStats();
console.log('Subscription statistics:', {
  activeConnections: stats.activeConnections,
  totalSubscriptions: stats.totalSubscriptions,
  messagesSent: stats.messagesSent,
  messagesReceived: stats.messagesReceived,
  averageConnectionDuration: `${(stats.averageConnectionDuration / 1000).toFixed(0)}s`,
  peakConnections: stats.peakConnections,
  errorRate: `${(stats.errorRate * 100).toFixed(2)}%`,
  uptime: `${(stats.uptime / 3600 / 1000).toFixed(1)}h`
});

// Alert on poor health
if (!health.healthy || stats.errorRate > 0.05) {
  alertOps({
    severity: 'WARNING',
    message: 'Subscription system degraded',
    details: { health, stats }
  });
}
```

---

## Authentication & Authorization

### 1. Connection Authentication

Authenticate WebSocket connections:

```typescript
import { ISubscriptionAuth, GRAPHQL_TOOLKIT_TYPES } from '@chasenocap/graphql-toolkit';

class SubscriptionAuthHandler implements ISubscriptionAuth {
  async authenticate(request, subscriptionName, variables) {
    // Extract token from connection params or headers
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const user = await verifyToken(token);
      request.user = user; // Attach to request context
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async authorize(userId, subscriptionName, variables) {
    // Check user permissions for subscription
    const permissions = await getUserPermissions(userId);

    switch (subscriptionName) {
      case 'adminNotifications':
        return permissions.includes('admin');

      case 'orderUpdates':
        // Users can only subscribe to their own orders
        return variables.customerId === userId;

      case 'repoEvents':
        // Check repo access
        return await hasRepoAccess(userId, variables.owner, variables.repo);

      default:
        return true; // Public subscription
    }
  }

  async getUserContext(request) {
    return {
      user: request.user,
      ip: request.ip,
      timestamp: new Date()
    };
  }
}

// Register auth handler
container.bind(GRAPHQL_TOOLKIT_TYPES.ISubscriptionAuth).to(SubscriptionAuthHandler);
```

### 2. Subscription-Level Authorization

Implement fine-grained authorization:

```typescript
const sensitiveDataSubscription = {
  subscribe: async (parent, args, context, info) => {
    // Verify authorization before creating subscription
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const canAccess = await authorizeResource(
      context.user.id,
      args.resourceId
    );

    if (!canAccess) {
      throw new Error('Unauthorized: Insufficient permissions');
    }

    // Create subscription only if authorized
    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getResourceStream(args.resourceId);
        for await (const update of stream) {
          // Double-check permissions on each event (in case they changed)
          const stillAuthorized = await authorizeResource(
            context.user.id,
            args.resourceId
          );

          if (!stillAuthorized) {
            throw new Error('Authorization revoked');
          }

          yield {
            data: update,
            metadata: {
              timestamp: new Date(),
              source: 'secure-service'
            }
          };
        }
      }
    };
  }
};
```

### 3. Dynamic Permission Checks

Re-validate permissions during subscription lifetime:

```typescript
const teamChatSubscription = {
  subscribe: async (parent, args, context, info) => {
    const { teamId } = args;

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getTeamChatStream(teamId);
        for await (const message of stream) {
          yield {
            data: message,
            metadata: {
              timestamp: new Date(),
              source: 'chat-service'
            }
          };
        }
      }
    };
  },
  filter: async (payload, variables, context) => {
    const { teamId } = variables;
    const message = payload.data;

    // Recheck team membership on each message
    const isMember = await isTeamMember(context.user.id, teamId);
    if (!isMember) {
      console.warn(`User ${context.user.id} no longer in team ${teamId}`);
      return false;
    }

    // Check if message is private
    if (message.isPrivate) {
      return message.recipientId === context.user.id;
    }

    return true;
  }
};
```

---

## Performance Optimization

### 1. Batching and Buffering

Optimize message delivery with batching:

```typescript
const highFrequencySubscription = {
  subscribe: async (parent, args, context, info) => {
    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getHighFrequencyStream();
        let buffer = [];
        let timer;

        for await (const event of stream) {
          buffer.push(event);

          // Batch events and send every 100ms or when buffer reaches 10 items
          if (buffer.length >= 10) {
            yield {
              data: { events: buffer },
              metadata: {
                timestamp: new Date(),
                source: 'stream-service',
                batchSize: buffer.length
              }
            };
            buffer = [];
            clearTimeout(timer);
          } else if (!timer) {
            timer = setTimeout(() => {
              if (buffer.length > 0) {
                yield {
                  data: { events: buffer },
                  metadata: {
                    timestamp: new Date(),
                    source: 'stream-service',
                    batchSize: buffer.length
                  }
                };
                buffer = [];
              }
            }, 100);
          }
        }
      }
    };
  }
};
```

### 2. Selective Updates

Send only changed fields to reduce bandwidth:

```typescript
const resourceUpdatesSubscription = {
  subscribe: async (parent, args, context, info) => {
    const { resourceId, fields } = args;
    let previousState = await getResource(resourceId);

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getResourceUpdateStream(resourceId);
        for await (const update of stream) {
          // Calculate diff
          const changes = {};
          const requestedFields = fields || Object.keys(update);

          requestedFields.forEach(field => {
            if (update[field] !== previousState[field]) {
              changes[field] = update[field];
            }
          });

          // Only send if there are actual changes
          if (Object.keys(changes).length > 0) {
            previousState = update;
            yield {
              data: {
                resourceId,
                changes,
                timestamp: Date.now()
              },
              metadata: {
                timestamp: new Date(),
                source: 'resource-service'
              }
            };
          }
        }
      }
    };
  }
};
```

### 3. Connection Pooling

Reuse event streams across multiple subscribers:

```typescript
class StreamPool {
  private streams = new Map<string, AsyncIterator<any>>();
  private subscribers = new Map<string, number>();

  async getOrCreateStream(key: string, factory: () => Promise<AsyncIterator<any>>) {
    if (!this.streams.has(key)) {
      this.streams.set(key, await factory());
      this.subscribers.set(key, 0);
    }

    const count = this.subscribers.get(key) || 0;
    this.subscribers.set(key, count + 1);

    return this.streams.get(key)!;
  }

  async releaseStream(key: string) {
    const count = (this.subscribers.get(key) || 1) - 1;

    if (count <= 0) {
      // No more subscribers, clean up
      const stream = this.streams.get(key);
      if (stream && 'return' in stream) {
        await stream.return();
      }
      this.streams.delete(key);
      this.subscribers.delete(key);
    } else {
      this.subscribers.set(key, count);
    }
  }
}

const streamPool = new StreamPool();

const pooledSubscription = {
  subscribe: async (parent, args, context, info) => {
    const streamKey = `repo:${args.owner}/${args.repo}`;
    const stream = await streamPool.getOrCreateStream(
      streamKey,
      () => getGitHubEventStream(args.owner, args.repo)
    );

    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const event of stream) {
            yield {
              data: event,
              metadata: {
                timestamp: new Date(),
                source: 'github-pooled'
              }
            };
          }
        } finally {
          await streamPool.releaseStream(streamKey);
        }
      }
    };
  }
};
```

---

## Error Handling

### 1. Subscription Errors

Handle errors gracefully:

```typescript
const resilientSubscription = {
  subscribe: async (parent, args, context, info) => {
    return {
      async *[Symbol.asyncIterator]() {
        let retryCount = 0;
        const maxRetries = 3;

        while (true) {
          try {
            const stream = await getDataStream();
            retryCount = 0; // Reset on successful connection

            for await (const data of stream) {
              yield {
                data,
                metadata: {
                  timestamp: new Date(),
                  source: 'data-service'
                }
              };
            }
          } catch (error) {
            console.error('Stream error:', error);

            if (retryCount >= maxRetries) {
              // Send error to client
              yield {
                data: null,
                errors: [{
                  message: 'Subscription failed after retries',
                  extensions: {
                    code: 'SUBSCRIPTION_FAILED',
                    retries: retryCount
                  }
                }]
              };
              break;
            }

            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
          }
        }
      }
    };
  }
};
```

### 2. Middleware Error Handling

Use middleware for centralized error handling:

```typescript
import { ISubscriptionMiddleware, GRAPHQL_TOOLKIT_TYPES } from '@chasenocap/graphql-toolkit';

class ErrorHandlingMiddleware implements ISubscriptionMiddleware {
  async onError(error, subscriptionId, context) {
    console.error('Subscription error:', {
      subscriptionId,
      error: error.message,
      stack: error.stack,
      user: context?.user?.id,
      timestamp: new Date()
    });

    // Track error metrics
    metrics.increment('subscription.errors', {
      subscription: subscriptionId,
      error: error.name
    });

    // Alert on critical errors
    if (error.message.includes('CRITICAL')) {
      await alertOps({
        severity: 'CRITICAL',
        message: 'Subscription system error',
        error: error.message,
        subscriptionId
      });
    }
  }

  async beforeSubscribe(name, variables, context) {
    // Validate before creating subscription
    if (!context.user && requiresAuth(name)) {
      throw new Error('Authentication required');
    }
  }

  async beforePublish(topic, payload) {
    // Sanitize payload before publishing
    return {
      ...payload,
      data: sanitizeData(payload.data)
    };
  }
}

// Register middleware
container.bind(GRAPHQL_TOOLKIT_TYPES.ISubscriptionMiddleware).to(ErrorHandlingMiddleware);
```

---

## Best Practices

### 1. Subscription Design

**DO**:
- Use specific subscription names (`orderUpdated` not `updates`)
- Include timestamp metadata in all payloads
- Implement graceful degradation for connection failures
- Provide clear error messages to clients
- Version your subscription payloads

**DON'T**:
- Create subscriptions for rarely changing data (use queries)
- Send entire large objects (send deltas when possible)
- Forget to clean up resources on unsubscribe
- Ignore authentication/authorization
- Create overly broad subscriptions

### 2. Scalability

**Horizontal Scaling**:
```typescript
// Use Redis PubSub for distributed subscriptions
import Redis from 'ioredis';

const publisher = new Redis(redisConfig);
const subscriber = new Redis(redisConfig);

subscriber.on('message', (channel, message) => {
  const payload = JSON.parse(message);
  subscriptionManager.publish(channel, payload);
});

// Subscribe to channels
subscriber.subscribe('orders', 'notifications', 'chat');

// Publish from any instance
const publishDistributed = async (channel, data) => {
  await publisher.publish(channel, JSON.stringify(data));
};
```

### 3. Monitoring

Track key metrics:
```typescript
// Subscription metrics
metrics.gauge('subscriptions.active', stats.activeConnections);
metrics.gauge('subscriptions.total', stats.totalSubscriptions);
metrics.gauge('subscriptions.messages_sent', stats.messagesSent);
metrics.gauge('subscriptions.error_rate', stats.errorRate);

// Per-subscription metrics
metrics.gauge('subscription.connections', connectionCount, {
  subscription: subscriptionName
});
metrics.histogram('subscription.message_size', messageSize, {
  subscription: subscriptionName
});
metrics.histogram('subscription.latency', latency, {
  subscription: subscriptionName
});
```

---

## Real-World Examples

### 1. Live Dashboard Updates

```graphql
subscription DashboardMetrics($dashboardId: ID!) {
  dashboardUpdated(dashboardId: $dashboardId) {
    dashboardId
    metrics {
      name
      value
      timestamp
    }
    alerts {
      level
      message
    }
  }
}
```

Implementation:
```typescript
const dashboardSubscription = {
  subscribe: async (parent, args, context) => {
    const { dashboardId } = args;

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getMetricsStream(dashboardId);
        for await (const metrics of stream) {
          yield {
            data: {
              dashboardId,
              metrics: metrics.data,
              alerts: metrics.alerts
            },
            metadata: {
              timestamp: new Date(),
              source: 'metrics-collector'
            }
          };
        }
      }
    };
  },
  filter: (payload, variables, context) => {
    // Only send if user has access to dashboard
    return hasDashboardAccess(context.user.id, variables.dashboardId);
  }
};
```

### 2. Collaborative Editing

```graphql
subscription DocumentChanges($documentId: ID!) {
  documentChanged(documentId: $documentId) {
    documentId
    userId
    changes {
      type
      position
      content
    }
    version
  }
}
```

Implementation:
```typescript
const collaborativeEditSubscription = {
  subscribe: async (parent, args, context) => {
    const { documentId } = args;

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getDocumentChangeStream(documentId);
        for await (const change of stream) {
          yield {
            data: {
              documentId,
              userId: change.userId,
              changes: change.operations,
              version: change.version
            },
            metadata: {
              timestamp: new Date(),
              source: 'collab-service',
              correlationId: change.id
            }
          };
        }
      }
    };
  },
  filter: (payload, variables, context) => {
    // Don't send user's own changes back to them
    return payload.data.userId !== context.user.id;
  }
};
```

### 3. Build Status Notifications

```graphql
subscription BuildStatus($repoId: ID!, $branch: String) {
  buildStatusChanged(repoId: $repoId, branch: $branch) {
    buildId
    status
    branch
    commit
    startedAt
    completedAt
    logs {
      level
      message
    }
  }
}
```

Implementation:
```typescript
const buildStatusSubscription = {
  subscribe: async (parent, args, context) => {
    const { repoId, branch } = args;

    return {
      async *[Symbol.asyncIterator]() {
        const stream = await getBuildStatusStream(repoId);
        for await (const build of stream) {
          yield {
            data: {
              buildId: build.id,
              status: build.status,
              branch: build.branch,
              commit: build.commit,
              startedAt: build.startedAt,
              completedAt: build.completedAt,
              logs: build.logs
            },
            metadata: {
              timestamp: new Date(),
              source: 'ci-service',
              version: '1.0'
            }
          };
        }
      }
    };
  },
  filter: (payload, variables, context) => {
    const { branch } = variables;
    const build = payload.data;

    // Filter by branch if specified
    if (branch && build.branch !== branch) {
      return false;
    }

    // Check repo access
    return hasRepoAccess(context.user.id, variables.repoId);
  }
};
```

---

## Additional Resources

- **Mercurius Subscriptions**: https://mercurius.dev/docs/subscriptions
- **GraphQL Spec**: https://spec.graphql.org/June2018/#sec-Subscription
- **WebSocket Protocol**: https://datatracker.ietf.org/doc/html/rfc6455
- **graphql-toolkit CLAUDE.md**: See `CLAUDE.md` for implementation details

---

*Part of the metaGOTHIC Framework - AI-Guided Opinionated TypeScript Framework*
