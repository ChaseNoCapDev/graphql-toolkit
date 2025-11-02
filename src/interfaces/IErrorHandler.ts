import type { GraphQLError, GraphQLFormattedError } from 'graphql';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface IGraphQLErrorExtensions {
  code: string;
  classification: 'UserError' | 'BusinessError' | 'SystemError' | 'ValidationError';
  timestamp: string;
  requestId?: string;
  userId?: string;
  path?: string[];
  field?: string;
  operation?: string;
  variables?: Record<string, any>;
  stack?: string;
  originalError?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

export interface IErrorHandlerOptions {
  includeStackTrace?: boolean;
  includeVariables?: boolean;
  sanitizeErrors?: boolean;
  logErrors?: boolean;
  customErrorCodes?: Map<string, string>;
  enableExtensions?: boolean;
  maskInternalErrors?: boolean;
}

export interface IErrorFormatter {
  /**
   * Format a GraphQL error for client response
   */
  format(error: GraphQLError, context?: IErrorContext): GraphQLFormattedError;

  /**
   * Create standardized error extensions
   */
  createExtensions(
    error: GraphQLError,
    context?: IErrorContext
  ): IGraphQLErrorExtensions;

  /**
   * Sanitize error messages for production
   */
  sanitize(error: GraphQLError): GraphQLError;

  /**
   * Classify error type for proper handling
   */
  classify(error: GraphQLError): IGraphQLErrorExtensions['classification'];
}

export interface IErrorContext {
  request?: FastifyRequest;
  reply?: FastifyReply;
  operation?: string;
  variables?: Record<string, any>;
  userId?: string;
  requestId?: string;
  path?: string[];
}

export interface IErrorLogger {
  /**
   * Log GraphQL errors with appropriate level
   */
  logError(error: GraphQLError, context?: IErrorContext): void;

  /**
   * Log performance warnings
   */
  logPerformanceWarning(message: string, metrics: Record<string, any>): void;

  /**
   * Log validation errors
   */
  logValidationError(errors: GraphQLError[]): void;
}

export interface IErrorHandler {
  /**
   * Handle GraphQL execution errors
   */
  handleExecutionError(error: GraphQLError, context?: IErrorContext): GraphQLFormattedError;

  /**
   * Handle validation errors
   */
  handleValidationErrors(errors: readonly GraphQLError[]): GraphQLFormattedError[];

  /**
   * Handle schema errors
   */
  handleSchemaError(error: Error): GraphQLFormattedError;

  /**
   * Create user-friendly error response
   */
  createUserError(message: string, code?: string, metadata?: Record<string, any>): GraphQLError;

  /**
   * Create business logic error
   */
  createBusinessError(message: string, code?: string, metadata?: Record<string, any>): GraphQLError;

  /**
   * Create system error with masking
   */
  createSystemError(error: Error, requestId?: string): GraphQLError;

  /**
   * Set error handler options
   */
  configure(options: IErrorHandlerOptions): void;
}

export interface IErrorMetrics {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsByCode: Map<string, number>;
  errorsByPath: Map<string, number>;
  averageResponseTime: number;
  lastError: Date;
  errorRate: number;
}

export interface IErrorMonitor {
  /**
   * Track error occurrence
   */
  trackError(error: GraphQLError, context?: IErrorContext): void;

  /**
   * Get error metrics
   */
  getMetrics(): IErrorMetrics;

  /**
   * Get error trends over time
   */
  getErrorTrends(timeframe: 'hour' | 'day' | 'week'): Map<string, number>;

  /**
   * Check if error rate exceeds threshold
   */
  isErrorRateHigh(): boolean;

  /**
   * Reset metrics
   */
  reset(): void;
}

export interface IErrorRecovery {
  /**
   * Attempt to recover from execution error
   */
  recover(error: GraphQLError, context?: IErrorContext): Promise<any>;

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: GraphQLError): boolean;

  /**
   * Get fallback data for failed operation
   */
  getFallbackData(operation: string, variables?: Record<string, any>): Promise<any>;
}