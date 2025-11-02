import type { GraphQLResolveInfo, DocumentNode } from 'graphql';

export interface IQueryMetrics {
  queryId: string;
  operation: string;
  operationType: 'query' | 'mutation' | 'subscription';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  complexity: number;
  depth: number;
  fieldCount: number;
  variables: Record<string, any>;
  errors?: string[];
  cacheHits: number;
  cacheMisses: number;
  dataLoaderBatches: number;
  dataLoaderCacheHits: number;
  memoryUsage?: number;
  userId?: string;
  requestId?: string;
}

export interface IFieldMetrics {
  fieldName: string;
  typeName: string;
  path: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  cacheHit: boolean;
  errors?: string[];
  resolverComplexity: number;
  dataFetched: boolean;
}

export interface IPerformanceThresholds {
  maxQueryComplexity: number;
  maxQueryDepth: number;
  slowQueryThreshold: number;
  maxMemoryUsage: number;
  maxConcurrentQueries: number;
  dataLoaderBatchThreshold: number;
}

export interface IPerformanceStats {
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  complexQueries: number;
  cacheHitRate: number;
  errorRate: number;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  concurrentQueries: {
    current: number;
    peak: number;
  };
  dataLoaderStats: {
    totalBatches: number;
    averageBatchSize: number;
    cacheHitRate: number;
  };
}

export interface IPerformanceAlert {
  type: 'threshold' | 'anomaly' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold?: number;
  timestamp: Date;
  queryId?: string;
  operation?: string;
  resolution?: string;
}

export interface IQueryComplexityAnalyzer {
  /**
   * Calculate query complexity score
   */
  calculateComplexity(document: DocumentNode, variables?: Record<string, any>): number;

  /**
   * Calculate query depth
   */
  calculateDepth(document: DocumentNode): number;

  /**
   * Count total fields in query
   */
  countFields(document: DocumentNode): number;

  /**
   * Validate query against thresholds
   */
  validateQuery(
    document: DocumentNode,
    variables?: Record<string, any>,
    thresholds?: Partial<IPerformanceThresholds>
  ): IQueryValidationResult;

  /**
   * Estimate query cost
   */
  estimateCost(document: DocumentNode, variables?: Record<string, any>): IQueryCostEstimate;
}

export interface IQueryValidationResult {
  valid: boolean;
  complexity: number;
  depth: number;
  fieldCount: number;
  violations: IThresholdViolation[];
  warnings: string[];
}

export interface IQueryCostEstimate {
  complexity: number;
  estimatedTime: number;
  estimatedMemory: number;
  dataLoaderCalls: number;
  cacheableFields: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface IThresholdViolation {
  type: 'complexity' | 'depth' | 'fieldCount' | 'time' | 'memory';
  value: number;
  threshold: number;
  message: string;
}

export interface IPerformanceMonitor {
  /**
   * Start monitoring a query
   */
  startQuery(
    queryId: string,
    document: DocumentNode,
    variables?: Record<string, any>,
    context?: any
  ): IQueryMetrics;

  /**
   * End monitoring a query
   */
  endQuery(queryId: string, errors?: Error[]): void;

  /**
   * Start monitoring a field resolver
   */
  startField(
    queryId: string,
    info: GraphQLResolveInfo
  ): IFieldMetrics;

  /**
   * End monitoring a field resolver
   */
  endField(queryId: string, fieldPath: string[], errors?: Error[]): void;

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(queryId: string, fieldPath: string[], hit: boolean): void;

  /**
   * Record DataLoader batch
   */
  recordDataLoaderBatch(
    queryId: string,
    loaderName: string,
    batchSize: number,
    cacheHits: number
  ): void;

  /**
   * Get performance statistics
   */
  getStats(timeframe?: 'hour' | 'day' | 'week'): IPerformanceStats;

  /**
   * Get slow queries
   */
  getSlowQueries(limit?: number): IQueryMetrics[];

  /**
   * Get complex queries
   */
  getComplexQueries(limit?: number): IQueryMetrics[];

  /**
   * Get recent alerts
   */
  getAlerts(severity?: IPerformanceAlert['severity']): IPerformanceAlert[];

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<IPerformanceThresholds>): void;

  /**
   * Generate performance report
   */
  generateReport(
    timeframe: 'hour' | 'day' | 'week',
    format: 'json' | 'csv' | 'html'
  ): Promise<string>;
}

export interface IPerformanceOptimizer {
  /**
   * Suggest query optimizations
   */
  analyzeQuery(document: DocumentNode, variables?: Record<string, any>): IOptimizationSuggestion[];

  /**
   * Suggest schema optimizations
   */
  analyzeSchema(stats: IPerformanceStats): ISchemaOptimizationSuggestion[];

  /**
   * Suggest caching strategies
   */
  suggestCaching(fieldMetrics: Map<string, IFieldMetrics[]>): ICachingSuggestion[];
}

export interface IOptimizationSuggestion {
  type: 'query' | 'dataloader' | 'caching' | 'batching';
  priority: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number;
}

export interface ISchemaOptimizationSuggestion {
  type: 'field' | 'type' | 'resolver' | 'index';
  target: string;
  description: string;
  reason: string;
  implementation: string;
}

export interface ICachingSuggestion {
  fieldPath: string;
  strategy: 'field-level' | 'dataloader' | 'query' | 'response';
  ttl: number;
  reason: string;
  expectedImprovement: number;
}