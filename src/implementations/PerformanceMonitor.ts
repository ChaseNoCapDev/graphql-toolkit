import { injectable, inject } from 'inversify';
import {
  DocumentNode,
  visit,
  Kind,
  GraphQLResolveInfo,
  ValidationRule,
  NoSchemaIntrospectionCustomRule,
} from 'graphql';
import type { ILogger } from '@chasenocap/logger';
import type {
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
} from '../interfaces/IPerformanceMonitor.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class QueryComplexityAnalyzer implements IQueryComplexityAnalyzer {
  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger
  ) {}

  calculateComplexity(document: DocumentNode, variables?: Record<string, any>): number {
    let complexity = 0;

    visit(document, {
      Field: {
        enter: (node) => {
          // Base complexity per field
          complexity += 1;

          // Add complexity for arguments
          if (node.arguments && node.arguments.length > 0) {
            complexity += node.arguments.length * 0.5;
          }

          // Add complexity for list fields (inferred from common naming)
          if (node.name.value.endsWith('s') || 
              node.name.value.includes('list') || 
              node.name.value.includes('all')) {
            complexity += 2;
          }

          // Add complexity for connection fields
          if (node.name.value.includes('connection') || 
              node.name.value.includes('edges')) {
            complexity += 3;
          }
        },
      },
      FragmentSpread: {
        enter: () => {
          complexity += 1;
        },
      },
      InlineFragment: {
        enter: () => {
          complexity += 0.5;
        },
      },
    });

    return Math.round(complexity);
  }

  calculateDepth(document: DocumentNode): number {
    let maxDepth = 0;

    const calculateNodeDepth = (node: any, currentDepth: number): number => {
      let depth = currentDepth;

      visit(node, {
        Field: {
          enter: () => {
            depth++;
          },
          leave: () => {
            maxDepth = Math.max(maxDepth, depth);
            depth--;
          },
        },
      });

      return depth;
    };

    visit(document, {
      OperationDefinition: {
        enter: (node) => {
          calculateNodeDepth(node, 0);
        },
      },
    });

    return maxDepth;
  }

  countFields(document: DocumentNode): number {
    let fieldCount = 0;

    visit(document, {
      Field: {
        enter: () => {
          fieldCount++;
        },
      },
    });

    return fieldCount;
  }

  validateQuery(
    document: DocumentNode,
    variables?: Record<string, any>,
    thresholds?: Partial<IPerformanceThresholds>
  ): IQueryValidationResult {
    const defaultThresholds: IPerformanceThresholds = {
      maxQueryComplexity: 100,
      maxQueryDepth: 10,
      slowQueryThreshold: 1000,
      maxMemoryUsage: 512,
      maxConcurrentQueries: 100,
      dataLoaderBatchThreshold: 10,
    };

    const effectiveThresholds = { ...defaultThresholds, ...thresholds };
    
    const complexity = this.calculateComplexity(document, variables);
    const depth = this.calculateDepth(document);
    const fieldCount = this.countFields(document);

    const violations: IThresholdViolation[] = [];
    const warnings: string[] = [];

    // Check complexity
    if (complexity > effectiveThresholds.maxQueryComplexity) {
      violations.push({
        type: 'complexity',
        value: complexity,
        threshold: effectiveThresholds.maxQueryComplexity,
        message: `Query complexity ${complexity} exceeds maximum ${effectiveThresholds.maxQueryComplexity}`,
      });
    }

    // Check depth
    if (depth > effectiveThresholds.maxQueryDepth) {
      violations.push({
        type: 'depth',
        value: depth,
        threshold: effectiveThresholds.maxQueryDepth,
        message: `Query depth ${depth} exceeds maximum ${effectiveThresholds.maxQueryDepth}`,
      });
    }

    // Check field count
    if (fieldCount > 50) {
      warnings.push(`High field count: ${fieldCount}. Consider using fragments or breaking into multiple queries.`);
    }

    return {
      valid: violations.length === 0,
      complexity,
      depth,
      fieldCount,
      violations,
      warnings,
    };
  }

  estimateCost(document: DocumentNode, variables?: Record<string, any>): IQueryCostEstimate {
    const complexity = this.calculateComplexity(document, variables);
    const depth = this.calculateDepth(document);
    const fieldCount = this.countFields(document);

    // Estimate based on complexity and field count
    const estimatedTime = Math.max(50, complexity * 10 + fieldCount * 2); // Base 50ms
    const estimatedMemory = Math.max(1, complexity * 0.5 + fieldCount * 0.1); // MB
    const dataLoaderCalls = Math.floor(fieldCount / 3); // Estimate 1 DataLoader call per 3 fields
    const cacheableFields = Math.floor(fieldCount * 0.7); // 70% of fields potentially cacheable

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (complexity > 50 || depth > 7) {
      riskLevel = 'medium';
    }
    if (complexity > 80 || depth > 9) {
      riskLevel = 'high';
    }

    return {
      complexity,
      estimatedTime,
      estimatedMemory,
      dataLoaderCalls,
      cacheableFields,
      riskLevel,
    };
  }
}

@injectable()
export class PerformanceMonitor implements IPerformanceMonitor {
  private activeQueries = new Map<string, IQueryMetrics>();
  private completedQueries: IQueryMetrics[] = [];
  private fieldMetrics = new Map<string, IFieldMetrics[]>();
  private alerts: IPerformanceAlert[] = [];
  private thresholds: IPerformanceThresholds = {
    maxQueryComplexity: 100,
    maxQueryDepth: 10,
    slowQueryThreshold: 1000,
    maxMemoryUsage: 512,
    maxConcurrentQueries: 100,
    dataLoaderBatchThreshold: 10,
  };

  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger,
    @inject(GRAPHQL_TOOLKIT_TYPES.IQueryComplexityAnalyzer) private complexityAnalyzer: IQueryComplexityAnalyzer
  ) {}

  startQuery(
    queryId: string,
    document: DocumentNode,
    variables?: Record<string, any>,
    context?: any
  ): IQueryMetrics {
    const validation = this.complexityAnalyzer.validateQuery(document, variables, this.thresholds);
    
    const metrics: IQueryMetrics = {
      queryId,
      operation: this.extractOperationName(document),
      operationType: this.extractOperationType(document),
      startTime: new Date(),
      complexity: validation.complexity,
      depth: validation.depth,
      fieldCount: validation.fieldCount,
      variables: variables || {},
      cacheHits: 0,
      cacheMisses: 0,
      dataLoaderBatches: 0,
      dataLoaderCacheHits: 0,
      userId: context?.userId,
      requestId: context?.requestId,
    };

    this.activeQueries.set(queryId, metrics);

    // Check for violations and create alerts
    if (!validation.valid) {
      for (const violation of validation.violations) {
        this.createAlert('threshold', 'high', violation.message, violation.type, violation.value, violation.threshold, queryId);
      }
    }

    this.logger.debug('Query monitoring started', {
      queryId,
      operation: metrics.operation,
      complexity: metrics.complexity,
      depth: metrics.depth,
    });

    return metrics;
  }

  endQuery(queryId: string, errors?: Error[]): void {
    const metrics = this.activeQueries.get(queryId);
    if (!metrics) {
      this.logger.warn('Attempted to end unknown query', { queryId });
      return;
    }

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    
    if (errors && errors.length > 0) {
      metrics.errors = errors.map(e => e.message);
    }

    // Check for slow query
    if (metrics.duration > this.thresholds.slowQueryThreshold) {
      this.createAlert(
        'threshold',
        'medium',
        `Slow query detected: ${metrics.duration}ms`,
        'time',
        metrics.duration,
        this.thresholds.slowQueryThreshold,
        queryId,
        metrics.operation
      );
    }

    this.activeQueries.delete(queryId);
    this.completedQueries.push(metrics);

    // Keep only recent queries (last 1000)
    if (this.completedQueries.length > 1000) {
      this.completedQueries = this.completedQueries.slice(-1000);
    }

    this.logger.debug('Query monitoring ended', {
      queryId,
      duration: metrics.duration,
      errors: metrics.errors?.length || 0,
    });
  }

  startField(queryId: string, info: GraphQLResolveInfo): IFieldMetrics {
    const fieldMetrics: IFieldMetrics = {
      fieldName: info.fieldName,
      typeName: info.parentType.name,
      path: info.path ? this.pathToArray(info.path) : [],
      startTime: new Date(),
      cacheHit: false,
      resolverComplexity: 1,
      dataFetched: false,
    };

    const key = `${queryId}-${fieldMetrics.path.join('.')}`;
    if (!this.fieldMetrics.has(key)) {
      this.fieldMetrics.set(key, []);
    }
    this.fieldMetrics.get(key)!.push(fieldMetrics);

    return fieldMetrics;
  }

  endField(queryId: string, fieldPath: string[], errors?: Error[]): void {
    const key = `${queryId}-${fieldPath.join('.')}`;
    const metrics = this.fieldMetrics.get(key);
    
    if (metrics && metrics.length > 0) {
      const fieldMetric = metrics[metrics.length - 1];
      fieldMetric.endTime = new Date();
      fieldMetric.duration = fieldMetric.endTime.getTime() - fieldMetric.startTime.getTime();
      
      if (errors && errors.length > 0) {
        fieldMetric.errors = errors.map(e => e.message);
      }
    }
  }

  recordCacheEvent(queryId: string, fieldPath: string[], hit: boolean): void {
    const metrics = this.activeQueries.get(queryId);
    if (metrics) {
      if (hit) {
        metrics.cacheHits++;
      } else {
        metrics.cacheMisses++;
      }
    }

    const key = `${queryId}-${fieldPath.join('.')}`;
    const fieldMetrics = this.fieldMetrics.get(key);
    if (fieldMetrics && fieldMetrics.length > 0) {
      fieldMetrics[fieldMetrics.length - 1].cacheHit = hit;
    }
  }

  recordDataLoaderBatch(
    queryId: string,
    loaderName: string,
    batchSize: number,
    cacheHits: number
  ): void {
    const metrics = this.activeQueries.get(queryId);
    if (metrics) {
      metrics.dataLoaderBatches++;
      metrics.dataLoaderCacheHits += cacheHits;
    }

    this.logger.debug('DataLoader batch recorded', {
      queryId,
      loaderName,
      batchSize,
      cacheHits,
    });
  }

  getStats(timeframe?: 'hour' | 'day' | 'week'): IPerformanceStats {
    const now = Date.now();
    let timeThreshold = 0;

    switch (timeframe) {
      case 'hour':
        timeThreshold = now - (60 * 60 * 1000);
        break;
      case 'day':
        timeThreshold = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        timeThreshold = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeThreshold = 0;
    }

    const relevantQueries = this.completedQueries.filter(
      q => q.startTime.getTime() > timeThreshold
    );

    const totalQueries = relevantQueries.length;
    const totalDuration = relevantQueries.reduce((sum, q) => sum + (q.duration || 0), 0);
    const averageQueryTime = totalQueries > 0 ? totalDuration / totalQueries : 0;
    
    const slowQueries = relevantQueries.filter(
      q => (q.duration || 0) > this.thresholds.slowQueryThreshold
    ).length;
    
    const complexQueries = relevantQueries.filter(
      q => q.complexity > this.thresholds.maxQueryComplexity * 0.8
    ).length;

    const totalCacheOps = relevantQueries.reduce(
      (sum, q) => sum + q.cacheHits + q.cacheMisses, 0
    );
    const totalCacheHits = relevantQueries.reduce((sum, q) => sum + q.cacheHits, 0);
    const cacheHitRate = totalCacheOps > 0 ? totalCacheHits / totalCacheOps : 0;

    const queriesWithErrors = relevantQueries.filter(q => q.errors && q.errors.length > 0).length;
    const errorRate = totalQueries > 0 ? queriesWithErrors / totalQueries : 0;

    const memoryUsage = process.memoryUsage();

    return {
      totalQueries,
      averageQueryTime,
      slowQueries,
      complexQueries,
      cacheHitRate,
      errorRate,
      memoryUsage: {
        current: memoryUsage.heapUsed / 1024 / 1024,
        peak: memoryUsage.heapUsed / 1024 / 1024, // Simplified
        average: memoryUsage.heapUsed / 1024 / 1024, // Simplified
      },
      concurrentQueries: {
        current: this.activeQueries.size,
        peak: this.activeQueries.size, // Simplified
      },
      dataLoaderStats: {
        totalBatches: relevantQueries.reduce((sum, q) => sum + q.dataLoaderBatches, 0),
        averageBatchSize: 10, // Simplified
        cacheHitRate: 0.8, // Simplified
      },
    };
  }

  getSlowQueries(limit = 10): IQueryMetrics[] {
    return [...this.completedQueries]
      .filter(q => q.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  getComplexQueries(limit = 10): IQueryMetrics[] {
    return [...this.completedQueries]
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, limit);
  }

  getAlerts(severity?: IPerformanceAlert['severity']): IPerformanceAlert[] {
    return severity 
      ? this.alerts.filter(a => a.severity === severity)
      : [...this.alerts];
  }

  setThresholds(thresholds: Partial<IPerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info('Performance thresholds updated', { thresholds: this.thresholds });
  }

  async generateReport(
    timeframe: 'hour' | 'day' | 'week',
    format: 'json' | 'csv' | 'html'
  ): Promise<string> {
    const stats = this.getStats(timeframe);
    const slowQueries = this.getSlowQueries(5);
    const complexQueries = this.getComplexQueries(5);
    const recentAlerts = this.alerts.slice(-10);

    const reportData = {
      timestamp: new Date().toISOString(),
      timeframe,
      stats,
      slowQueries,
      complexQueries,
      alerts: recentAlerts,
    };

    switch (format) {
      case 'json':
        return JSON.stringify(reportData, null, 2);
      
      case 'csv':
        return this.generateCSVReport(reportData);
      
      case 'html':
        return this.generateHTMLReport(reportData);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private createAlert(
    type: IPerformanceAlert['type'],
    severity: IPerformanceAlert['severity'],
    message: string,
    metric: string,
    value: number,
    threshold?: number,
    queryId?: string,
    operation?: string
  ): void {
    const alert: IPerformanceAlert = {
      type,
      severity,
      message,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      queryId,
      operation,
    };

    this.alerts.push(alert);

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.logger.warn('Performance alert created', { alert });
  }

  private extractOperationName(document: DocumentNode): string {
    for (const definition of document.definitions) {
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        return definition.name?.value || 'Anonymous';
      }
    }
    return 'Unknown';
  }

  private extractOperationType(document: DocumentNode): 'query' | 'mutation' | 'subscription' {
    for (const definition of document.definitions) {
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        return definition.operation;
      }
    }
    return 'query';
  }

  private pathToArray(path: any): string[] {
    const result: string[] = [];
    let current = path;
    
    while (current) {
      result.unshift(String(current.key));
      current = current.prev;
    }
    
    return result;
  }

  private generateCSVReport(data: any): string {
    // Simplified CSV generation
    const headers = ['timestamp', 'metric', 'value'];
    const rows = [
      [data.timestamp, 'totalQueries', data.stats.totalQueries],
      [data.timestamp, 'averageQueryTime', data.stats.averageQueryTime],
      [data.timestamp, 'errorRate', data.stats.errorRate],
    ];

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private generateHTMLReport(data: any): string {
    return `
      <html>
        <head><title>GraphQL Performance Report</title></head>
        <body>
          <h1>Performance Report (${data.timeframe})</h1>
          <h2>Statistics</h2>
          <ul>
            <li>Total Queries: ${data.stats.totalQueries}</li>
            <li>Average Query Time: ${data.stats.averageQueryTime.toFixed(2)}ms</li>
            <li>Error Rate: ${(data.stats.errorRate * 100).toFixed(2)}%</li>
            <li>Cache Hit Rate: ${(data.stats.cacheHitRate * 100).toFixed(2)}%</li>
          </ul>
          <h2>Recent Alerts</h2>
          <ul>
            ${data.alerts.map((alert: any) => `<li>${alert.severity}: ${alert.message}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;
  }
}