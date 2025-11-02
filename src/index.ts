// Core interfaces
export type {
  ISchemaComposer,
  IFederationGateway,
  ISchemaLayer,
  ICompositionOptions,
  IComposedSchema,
  ISchemaMetadata,
  IValidationResult,
  ISchemaConflict,
  IFederationSubgraph,
  IMercuriusConfig,
} from './interfaces/ISchemaComposer.js';

export type {
  IDataLoaderFactory,
  IDataLoaderRegistry,
  IBatchLoadFunction,
  IDataLoaderOptions,
  IDataLoaderConfig,
  IDataLoaderMetadata,
  IDataLoaderStats,
  IDataLoaderFactoryOptions,
  IGraphQLContext,
} from './interfaces/IDataLoaderFactory.js';

export type {
  IErrorHandler,
  IErrorFormatter,
  IErrorLogger,
  IErrorMonitor,
  IErrorRecovery,
  IErrorHandlerOptions,
  IGraphQLErrorExtensions,
  IErrorContext,
  IErrorMetrics,
} from './interfaces/IErrorHandler.js';

export type {
  ISubscriptionManager,
  IWebSocketManager,
  ISubscriptionAuth,
  ISubscriptionPayload,
  ISubscriptionFilter,
  ISubscriptionResolver,
  ISubscriptionOptions,
  ISubscriptionConnection,
  ISubscriptionStats,
  ISubscriptionHealth,
  ISubscriptionMiddleware,
} from './interfaces/ISubscriptionManager.js';

export type {
  IPerformanceMonitor,
  IQueryComplexityAnalyzer,
  IPerformanceOptimizer,
  IQueryMetrics,
  IFieldMetrics,
  IPerformanceThresholds,
  IPerformanceStats,
  IPerformanceAlert,
  IQueryValidationResult,
  IQueryCostEstimate,
  IThresholdViolation,
  IOptimizationSuggestion,
} from './interfaces/IPerformanceMonitor.js';

// Core implementations
export { SchemaComposer } from './implementations/SchemaComposer.js';
export { DataLoaderFactory, DataLoaderRegistry } from './implementations/DataLoaderFactory.js';
export {
  ErrorHandler,
  ErrorFormatter,
  ErrorLogger,
  ErrorMonitor,
} from './implementations/ErrorHandler.js';
export { SubscriptionManager } from './implementations/SubscriptionManager.js';
export {
  PerformanceMonitor,
  QueryComplexityAnalyzer,
} from './implementations/PerformanceMonitor.js';

// Types and tokens
export { GRAPHQL_TOOLKIT_TYPES } from './types/InjectionTokens.js';
export type {
  IGraphQLToolkitConfig,
  IMercuriusPluginOptions,
  IResolverContext,
  ISubscriptionContext,
  IFederationContext,
  QueryComplexityRule,
  DepthLimitRule,
  IGraphQLMiddleware,
  ISchemaDirective,
  IGraphQLPlugin,
  IQueryPlan,
  IQueryStep,
  IFederationEntity,
  ISubgraphHealth,
  IGatewayHealth,
} from './types/GraphQLTypes.js';

// Container and factory utilities
export {
  createGraphQLContainer,
  createSchemaComposer,
  createDataLoaderFactory,
  createErrorHandler,
  createSubscriptionManager,
  createPerformanceMonitor,
} from './utils/GraphQLContainer.js';
export type { IGraphQLToolkitOptions } from './utils/GraphQLContainer.js';

// Re-export commonly used GraphQL types
export type {
  GraphQLSchema,
  GraphQLError,
  GraphQLFormattedError,
  DocumentNode,
  GraphQLResolveInfo,
} from 'graphql';

// Re-export DataLoader
export { default as DataLoader } from 'dataloader';

// Mercurius integration utilities
export const createMercuriusPlugin = async (config: any) => {
  const { createGraphQLContainer } = await import('./utils/GraphQLContainer.js');
  const container = await createGraphQLContainer({ config });
  
  return {
    container,
    // Helper to get services from container
    getService: <T>(token: symbol): T => container.get<T>(token),
  };
};

// Default configurations
export const DEFAULT_PERFORMANCE_THRESHOLDS = {
  maxQueryComplexity: 100,
  maxQueryDepth: 10,
  slowQueryThreshold: 1000,
  maxMemoryUsage: 512,
  maxConcurrentQueries: 100,
  dataLoaderBatchThreshold: 10,
} as const;

export const DEFAULT_ERROR_OPTIONS = {
  includeStackTrace: process.env.NODE_ENV === 'development',
  includeVariables: process.env.NODE_ENV === 'development',
  sanitizeErrors: process.env.NODE_ENV === 'production',
  logErrors: true,
  enableExtensions: true,
  maskInternalErrors: process.env.NODE_ENV === 'production',
} as const;

export const DEFAULT_SUBSCRIPTION_OPTIONS = {
  bufferSize: 100,
  keepAlive: true,
  keepAliveInterval: 30000,
  connectionTimeout: 300000,
  maxConnections: 1000,
  enableCompression: true,
  enableBatching: false,
} as const;

// Version information
export const VERSION = '1.0.0';