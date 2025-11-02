# @chasenocap/graphql-toolkit

Shared GraphQL utilities and federation patterns for metaGOTHIC services. This package provides a comprehensive toolkit for building high-performance GraphQL APIs with Mercurius and Fastify.

## Features

### 🏗️ Schema Composition
- **Layered Architecture**: Compose schemas from multiple layers with dependency management
- **Federation Support**: Built-in support for Mercurius federation patterns
- **Conflict Resolution**: Automatic detection and resolution of schema conflicts
- **Validation**: Comprehensive schema validation and compatibility checking

### ⚡ Performance Optimization
- **Query Complexity Analysis**: Analyze and limit query complexity and depth
- **Performance Monitoring**: Real-time monitoring of query performance
- **DataLoader Factory**: Efficient batching and caching with DataLoader patterns
- **Mercurius Optimizations**: Leverage Mercurius-specific performance features

### 🛡️ Error Handling
- **Structured Errors**: Consistent error formatting with extensions
- **Error Classification**: Automatic categorization of errors (user, business, system)
- **Error Recovery**: Graceful error recovery and fallback mechanisms
- **Production Safety**: Automatic error sanitization for production environments

### 🔄 Real-time Features
- **Subscription Management**: WebSocket-based GraphQL subscriptions
- **Connection Handling**: Robust connection lifecycle management
- **Filtering**: Advanced subscription filtering and targeting
- **Health Monitoring**: Real-time health checks and metrics

## Installation

```bash
npm install @chasenocap/graphql-toolkit
```

## Quick Start

### Basic Setup

```typescript
import { createGraphQLContainer } from '@chasenocap/graphql-toolkit';

const container = await createGraphQLContainer({
  config: {
    enableFederation: true,
    enablePerformanceMonitoring: true,
    enableErrorHandling: true,
    enableSubscriptions: true,
    enableDataLoaders: true,
  },
});
```

### Schema Composition

```typescript
import { createSchemaComposer } from '@chasenocap/graphql-toolkit';

const composer = await createSchemaComposer();

const baseLayer = {
  name: 'base',
  schema: baseSchema,
  priority: 1,
};

const userLayer = {
  name: 'user',
  schema: userSchema,
  priority: 2,
  dependencies: ['base'],
};

const composedSchema = await composer.compose({
  layers: [baseLayer, userLayer],
  mergeStrategy: 'merge',
  validate: true,
});
```

### DataLoader Factory

```typescript
import { createDataLoaderFactory } from '@chasenocap/graphql-toolkit';

const factory = await createDataLoaderFactory();

// Create a monitored DataLoader
const userLoader = factory.createMonitoredLoader(
  async (userIds) => {
    return await batchLoadUsers(userIds);
  },
  {
    name: 'userLoader',
    entity: 'User',
    cacheTTL: 300000,
    performance: {
      expectedBatchSize: 10,
      maxLatency: 100,
    },
  }
);

// Use in GraphQL resolver
const resolvers = {
  Query: {
    user: (_, { id }, { dataloaders }) => {
      return dataloaders.userLoader.load(id);
    },
  },
};
```

### Error Handling

```typescript
import { createErrorHandler } from '@chasenocap/graphql-toolkit';

const errorHandler = await createErrorHandler();

// Configure error handling
errorHandler.configure({
  includeStackTrace: process.env.NODE_ENV === 'development',
  sanitizeErrors: process.env.NODE_ENV === 'production',
  logErrors: true,
});

// Create different types of errors
const userError = errorHandler.createUserError(
  'Invalid user ID provided',
  'INVALID_USER_ID'
);

const businessError = errorHandler.createBusinessError(
  'User has insufficient permissions',
  'INSUFFICIENT_PERMISSIONS'
);

// Handle execution errors
const formattedError = errorHandler.handleExecutionError(
  error,
  { requestId, userId, operation }
);
```

### Performance Monitoring

```typescript
import { createPerformanceMonitor } from '@chasenocap/graphql-toolkit';

const monitor = await createPerformanceMonitor();

// Configure thresholds
monitor.setThresholds({
  maxQueryComplexity: 100,
  maxQueryDepth: 10,
  slowQueryThreshold: 1000,
});

// Monitor a query
const metrics = monitor.startQuery(queryId, document, variables, context);

// Track field resolvers
const fieldMetrics = monitor.startField(queryId, info);
monitor.endField(queryId, fieldPath);

// Record cache events
monitor.recordCacheEvent(queryId, fieldPath, isHit);

// End monitoring
monitor.endQuery(queryId, errors);

// Get performance statistics
const stats = monitor.getStats('hour');
const slowQueries = monitor.getSlowQueries(10);
const alerts = monitor.getAlerts('high');
```

### Subscription Management

```typescript
import { createSubscriptionManager } from '@chasenocap/graphql-toolkit';

const subscriptionManager = await createSubscriptionManager();

// Create a subscription
const subscriptionId = await subscriptionManager.subscribe(
  'userUpdates',
  {
    subscribe: async (parent, args, context, info) => {
      return subscriptionIterator;
    },
    filter: (payload, variables, context) => {
      return payload.userId === variables.userId;
    },
  },
  {
    bufferSize: 100,
    keepAlive: true,
  }
);

// Publish to subscribers
await subscriptionManager.publish('userUpdates', {
  data: { userId: '123', name: 'Updated Name' },
  metadata: {
    timestamp: new Date(),
    source: 'user-service',
  },
});

// Publish with filtering
await subscriptionManager.publishToSubscribers(
  'userUpdates',
  payload,
  (payload, variables) => payload.data.userId === variables.userId
);
```

## Mercurius Integration

### Federation Gateway

```typescript
import fastify from 'fastify';
import mercurius from 'mercurius';
import { createMercuriusPlugin } from '@chasenocap/graphql-toolkit';

const app = fastify();

const { container, getService } = await createMercuriusPlugin({
  enableFederation: true,
  enablePerformanceMonitoring: true,
});

// Register Mercurius with federation
await app.register(mercurius, {
  gateway: {
    services: [
      { name: 'user-service', url: 'http://localhost:3001/graphql' },
      { name: 'order-service', url: 'http://localhost:3002/graphql' },
    ],
  },
  errorFormatter: (error, context) => {
    const errorHandler = getService(GRAPHQL_TOOLKIT_TYPES.IErrorHandler);
    return errorHandler.handleExecutionError(error, context);
  },
});
```

### Subgraph Service

```typescript
import fastify from 'fastify';
import mercurius from 'mercurius';
import { createPerformanceMonitor, createDataLoaderFactory } from '@chasenocap/graphql-toolkit';

const app = fastify();
const monitor = await createPerformanceMonitor();
const loaderFactory = await createDataLoaderFactory();

await app.register(mercurius, {
  schema: federatedSchema,
  resolvers,
  federationMetadata: true,
  context: async (request, reply) => {
    const queryId = generateQueryId();
    return {
      queryId,
      dataloaders: {
        userLoader: loaderFactory.createMonitoredLoader(
          batchLoadUsers,
          { name: 'userLoader', entity: 'User' }
        ),
      },
    };
  },
  onRequest: async (request, reply) => {
    const { query, variables } = request.body;
    if (query) {
      const document = parse(query);
      monitor.startQuery(request.id, document, variables, { request, reply });
    }
  },
  onResponse: async (request, reply) => {
    monitor.endQuery(request.id);
  },
});
```

## Configuration

### Performance Thresholds

```typescript
const thresholds = {
  maxQueryComplexity: 100,      // Maximum allowed query complexity
  maxQueryDepth: 10,            // Maximum query nesting depth
  slowQueryThreshold: 1000,     // Slow query threshold in ms
  maxMemoryUsage: 512,          // Memory limit in MB
  maxConcurrentQueries: 100,    // Concurrent query limit
  dataLoaderBatchThreshold: 10, // DataLoader batch size threshold
};
```

### Error Handling Options

```typescript
const errorOptions = {
  includeStackTrace: false,     // Include stack traces in responses
  includeVariables: false,      // Include variables in error logs
  sanitizeErrors: true,         // Sanitize error messages for production
  logErrors: true,              // Enable error logging
  enableExtensions: true,       // Include error extensions
  maskInternalErrors: true,     // Mask internal errors in production
};
```

### Subscription Options

```typescript
const subscriptionOptions = {
  bufferSize: 100,              // Message buffer size
  keepAlive: true,              // Enable keep-alive
  keepAliveInterval: 30000,     // Keep-alive interval in ms
  connectionTimeout: 300000,    // Connection timeout in ms
  maxConnections: 1000,         // Maximum concurrent connections
  enableCompression: true,      // Enable WebSocket compression
  enableBatching: false,        // Enable message batching
};
```

## API Reference

### Core Interfaces

- `ISchemaComposer` - Schema composition and layering
- `IDataLoaderFactory` - DataLoader creation and management
- `IErrorHandler` - Error handling and formatting
- `ISubscriptionManager` - Real-time subscription management
- `IPerformanceMonitor` - Performance monitoring and analysis

### Factory Functions

- `createGraphQLContainer(options)` - Create configured DI container
- `createSchemaComposer(options)` - Create schema composer
- `createDataLoaderFactory(options)` - Create DataLoader factory
- `createErrorHandler(options)` - Create error handler
- `createSubscriptionManager(options)` - Create subscription manager
- `createPerformanceMonitor(options)` - Create performance monitor

### Utilities

- `createMercuriusPlugin(config)` - Create Mercurius integration plugin
- `DEFAULT_PERFORMANCE_THRESHOLDS` - Default performance thresholds
- `DEFAULT_ERROR_OPTIONS` - Default error handling options
- `DEFAULT_SUBSCRIPTION_OPTIONS` - Default subscription options

## Best Practices

### Schema Design
- Use layered composition for modular schemas
- Define clear dependencies between layers
- Validate schemas during composition
- Use federation for microservice architectures

### Performance
- Set appropriate complexity and depth limits
- Monitor query performance in production
- Use DataLoaders for efficient data fetching
- Implement proper caching strategies

### Error Handling
- Use structured error responses
- Classify errors appropriately
- Log errors with proper context
- Sanitize errors in production

### Real-time Features
- Implement proper authentication for subscriptions
- Use filtering to reduce unnecessary messages
- Monitor connection health
- Handle connection lifecycle properly

## Contributing

See the main project [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.