# CLAUDE.md

This file provides guidance to Claude Code when working with the graphql-toolkit package.

## Package Identity

**Name**: graphql-toolkit  
**Purpose**: Shared GraphQL utilities and federation patterns for metaGOTHIC services  
**Status**: Active Development  
**Owner**: metaGOTHIC Team  
**Created**: May 2025  
**Size**: Large  
**Complexity**: High  

## Single Responsibility

This package is responsible for:
Providing comprehensive GraphQL utilities including schema composition, performance monitoring, error handling, DataLoader patterns, and subscription management for Mercurius-based services

This package is NOT responsible for:
- GraphQL schema definitions (that's service-specific)
- Business logic implementations
- HTTP server configuration
- Database operations
- Authentication/authorization logic

## Package Context in Monorepo

### Documentation Context

**IMPORTANT**: Before developing in this package, understand the broader context:

1. **Project Documentation Map**
   - `/CLAUDE.md` - Main project context and goals
   - `/docs/architecture-reference.md` - Overall architecture patterns
   - `/docs/decomposition-guide.md` - Package design philosophy
   - `/docs/backlog.md` - metaGOTHIC development progress

2. **Context Boundaries**
   - This package provides GraphQL infrastructure utilities
   - Works with Mercurius and Fastify for optimal performance
   - Integrates with other metaGOTHIC packages for logging, caching, DI
   - Supports both federation gateway and subgraph patterns

3. **Key Context to Inherit**
   - GraphQL-first architecture strategy
   - Mercurius over Apollo for performance benefits
   - TypeScript + DI patterns
   - Performance monitoring and optimization focus
   - Real-time subscription patterns

4. **What NOT to Include**
   - Specific business domain schemas
   - HTTP routing or middleware
   - Database-specific implementations
   - Service discovery logic

### Upstream Dependencies
- @chasenocap/di-framework (for dependency injection)
- @chasenocap/logger (for structured logging)
- @chasenocap/cache (for caching patterns)
- mercurius (GraphQL server for Fastify)
- @mercuriusjs/federation (federation support)
- @mercuriusjs/gateway (gateway implementation)
- @mercuriusjs/cache (GraphQL response caching)
- dataloader (efficient data batching)
- graphql (GraphQL implementation)
- fastify (web framework)

### Downstream Consumers
- metaGOTHIC GraphQL services (meta-gothic-app, repo-agent-service, claude-service)
- GraphQL federation gateways
- Mercurius-based microservices
- Performance monitoring dashboards

### Position in Architecture
Core infrastructure package that provides GraphQL utilities for the metaGOTHIC framework's GraphQL-first architecture

## Technical Architecture

### Core Components

#### Schema Composition (`ISchemaComposer`)
- **Layered Architecture**: Compose schemas from multiple layers with dependency management
- **Federation Support**: Built-in Mercurius federation patterns
- **Conflict Resolution**: Automatic detection and resolution of schema conflicts
- **Validation**: Comprehensive schema validation and compatibility checking

#### DataLoader Factory (`IDataLoaderFactory`)
- **Batch Loading**: Efficient batching of database queries
- **Caching**: Intelligent caching with TTL support
- **Monitoring**: Performance tracking for DataLoader operations
- **Registry**: Centralized DataLoader management and statistics

#### Error Handling (`IErrorHandler`)
- **Structured Errors**: Consistent error formatting with GraphQL extensions
- **Classification**: Automatic error categorization (user, business, system)
- **Production Safety**: Error sanitization for production environments
- **Monitoring**: Error rate tracking and alerting

#### Performance Monitoring (`IPerformanceMonitor`)
- **Query Analysis**: Complexity and depth analysis
- **Real-time Metrics**: Performance tracking and statistics
- **Alerting**: Threshold-based alerting system
- **Reporting**: Comprehensive performance reports

#### Subscription Management (`ISubscriptionManager`)
- **WebSocket Support**: Real-time GraphQL subscriptions
- **Connection Management**: Robust connection lifecycle handling
- **Filtering**: Advanced subscription filtering and targeting
- **Health Monitoring**: Connection health and performance metrics

### Design Patterns
- **Factory Pattern**: Service creation with configuration
- **Strategy Pattern**: Different composition and caching strategies
- **Observer Pattern**: Performance monitoring and alerting
- **Registry Pattern**: DataLoader and subscription management
- **Decorator Pattern**: Error handling and performance instrumentation

### Key Technologies
- **Mercurius**: High-performance GraphQL server for Fastify
- **DataLoader**: Batching and caching for GraphQL resolvers
- **GraphQL**: Schema definition and query execution
- **TypeScript**: Type safety and developer experience
- **Inversify**: Dependency injection framework

## Development Guidelines

### Code Organization
```
src/
├── interfaces/          # TypeScript interfaces
│   ├── ISchemaComposer.ts
│   ├── IDataLoaderFactory.ts
│   ├── IErrorHandler.ts
│   ├── ISubscriptionManager.ts
│   └── IPerformanceMonitor.ts
├── implementations/     # Concrete implementations
│   ├── SchemaComposer.ts
│   ├── DataLoaderFactory.ts
│   ├── ErrorHandler.ts
│   ├── SubscriptionManager.ts
│   └── PerformanceMonitor.ts
├── types/              # Type definitions and tokens
│   ├── InjectionTokens.ts
│   └── GraphQLTypes.ts
├── utils/              # Utility functions
│   └── GraphQLContainer.ts
└── index.ts            # Public API exports
```

### Naming Conventions
- Interfaces: `ISchemaComposer`, `IDataLoaderFactory`
- Implementations: `SchemaComposer`, `DataLoaderFactory`
- Types: `GraphQLToolkitConfig`, `PerformanceThresholds`
- Factories: `createSchemaComposer`, `createDataLoaderFactory`

### Testing Requirements
- Minimum 90% test coverage
- Unit tests for all components
- Integration tests with Mercurius
- Performance benchmarks
- Error handling edge cases

## Performance Considerations

### Mercurius Optimization
- Leverage Mercurius JIT compilation
- Use native Fastify integration
- Implement query caching strategies
- Optimize federation query planning

### DataLoader Patterns
- Batch similar data fetches
- Implement proper cache keys
- Monitor batch sizes and efficiency
- Use Redis for distributed caching

### Query Complexity
- Set appropriate complexity limits
- Monitor query depth and field count
- Implement query cost analysis
- Provide optimization suggestions

### Memory Management
- Monitor memory usage patterns
- Implement proper cleanup for subscriptions
- Use weak references where appropriate
- Profile for memory leaks

## Common Tasks

### Adding a New Schema Layer
1. Create layer definition with schema and metadata
2. Define dependencies if needed
3. Use SchemaComposer to add layer
4. Validate composition results
5. Test with GraphQL queries

### Creating a DataLoader
1. Define batch load function
2. Configure caching and batching options
3. Register with DataLoaderFactory
4. Use in GraphQL resolvers
5. Monitor performance metrics

### Implementing Error Handling
1. Classify error types appropriately
2. Create structured error extensions
3. Configure sanitization for production
4. Implement error recovery strategies
5. Monitor error rates and patterns

### Setting Up Subscriptions
1. Define subscription resolvers
2. Implement filtering logic
3. Configure connection management
4. Handle authentication and authorization
5. Monitor connection health

### Performance Monitoring
1. Configure performance thresholds
2. Implement query analysis
3. Set up alerting rules
4. Create performance dashboards
5. Generate regular reports

## Integration Examples

### Mercurius Federation Gateway
```typescript
import fastify from 'fastify';
import mercurius from 'mercurius';
import { createMercuriusPlugin } from '@chasenocap/graphql-toolkit';

const app = fastify();
const { container, getService } = await createMercuriusPlugin({
  enableFederation: true,
  enablePerformanceMonitoring: true,
});

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

### Schema Composition
```typescript
const composer = await createSchemaComposer();

const result = await composer.compose({
  layers: [
    {
      name: 'base',
      schema: baseSchema,
      priority: 1,
    },
    {
      name: 'user',
      schema: userSchema,
      priority: 2,
      dependencies: ['base'],
    },
  ],
  mergeStrategy: 'merge',
  validate: true,
});
```

### DataLoader Integration
```typescript
const factory = await createDataLoaderFactory();

const userLoader = factory.createMonitoredLoader(
  async (userIds) => await batchLoadUsers(userIds),
  {
    name: 'userLoader',
    entity: 'User',
    cacheTTL: 300000,
  }
);

// Use in resolver context
const context = {
  dataloaders: {
    userLoader,
  },
};
```

## Security Considerations
- Implement query complexity limits to prevent DoS
- Sanitize error messages in production
- Validate schema composition for security
- Implement proper authentication for subscriptions
- Monitor for suspicious query patterns
- Use secure WebSocket connections

## Known Issues
- Complex federation schemas may have composition conflicts
- Large subscription loads require connection pooling
- Performance monitoring adds overhead to queries
- DataLoader cache invalidation can be complex

## Future Enhancements
- Advanced query optimization suggestions
- Machine learning-based performance predictions
- Enhanced federation debugging tools
- Real-time schema evolution support
- Advanced subscription filtering patterns

## Maintenance Notes
- Monitor Mercurius updates for new features
- Keep GraphQL spec compliance updated
- Review performance thresholds regularly
- Update federation patterns as services evolve

## Questions to Ask When Developing
1. Is this GraphQL infrastructure or service-specific logic?
2. Does this integrate well with Mercurius patterns?
3. Am I following GraphQL best practices?
4. Is performance monitoring comprehensive?
5. Are errors handled consistently?
6. Is the API easy to use for service developers?
7. Does this support both gateway and subgraph patterns?
8. Is the implementation following DI patterns?

## Related Documentation
- Main monorepo: `/CLAUDE.md`
- GraphQL architecture: `/docs/ADR-005-graphql-first-architecture.md`
- Performance patterns: `/docs/performance-optimization-patterns.md`
- Mercurius documentation: https://mercurius.dev/
- Federation guide: https://mercurius.dev/docs/federation