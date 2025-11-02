export const GRAPHQL_TOOLKIT_TYPES = {
  // Schema Composition
  ISchemaComposer: Symbol.for('ISchemaComposer'),
  IFederationGateway: Symbol.for('IFederationGateway'),

  // DataLoader Factory
  IDataLoaderFactory: Symbol.for('IDataLoaderFactory'),
  IDataLoaderRegistry: Symbol.for('IDataLoaderRegistry'),

  // Error Handling
  IErrorHandler: Symbol.for('IErrorHandler'),
  IErrorFormatter: Symbol.for('IErrorFormatter'),
  IErrorLogger: Symbol.for('IErrorLogger'),
  IErrorMonitor: Symbol.for('IErrorMonitor'),
  IErrorRecovery: Symbol.for('IErrorRecovery'),

  // Subscription Management
  ISubscriptionManager: Symbol.for('ISubscriptionManager'),
  IWebSocketManager: Symbol.for('IWebSocketManager'),
  ISubscriptionAuth: Symbol.for('ISubscriptionAuth'),

  // Performance Monitoring
  IPerformanceMonitor: Symbol.for('IPerformanceMonitor'),
  IQueryComplexityAnalyzer: Symbol.for('IQueryComplexityAnalyzer'),
  IPerformanceOptimizer: Symbol.for('IPerformanceOptimizer'),

  // Utilities
  ILogger: Symbol.for('ILogger'),
  ICache: Symbol.for('ICache'),
} as const;

export type GraphQLToolkitTypes = typeof GRAPHQL_TOOLKIT_TYPES;
export type GraphQLToolkitTypeKeys = keyof GraphQLToolkitTypes;