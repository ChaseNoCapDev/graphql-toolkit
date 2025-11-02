import { injectable, inject } from 'inversify';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import type { ILogger } from '@chasenocap/logger';
import type {
  IErrorHandler,
  IErrorFormatter,
  IErrorLogger,
  IErrorMonitor,
  IErrorHandlerOptions,
  IGraphQLErrorExtensions,
  IErrorContext,
  IErrorMetrics,
} from '../interfaces/IErrorHandler.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class ErrorFormatter implements IErrorFormatter {
  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger
  ) {}

  format(error: GraphQLError, context?: IErrorContext): GraphQLFormattedError {
    const extensions = this.createExtensions(error, context);
    
    return {
      message: this.sanitizeMessage(error.message),
      locations: error.locations,
      path: error.path,
      extensions: extensions as Record<string, any>,
    };
  }

  createExtensions(error: GraphQLError, context?: IErrorContext): IGraphQLErrorExtensions {
    const classification = this.classify(error);
    
    const extensions: IGraphQLErrorExtensions = {
      code: this.getErrorCode(error),
      classification,
      timestamp: new Date().toISOString(),
      requestId: context?.requestId,
      userId: context?.userId,
      path: error.path as string[],
      operation: context?.operation,
    };

    // Add field information if available
    if (error.path && error.path.length > 0) {
      extensions.field = error.path[error.path.length - 1] as string;
    }

    // Add variables in development
    if (context?.variables && process.env.NODE_ENV !== 'production') {
      extensions.variables = this.sanitizeVariables(context.variables);
    }

    // Add original error information
    if (error.originalError) {
      extensions.originalError = {
        name: error.originalError.name,
        message: error.originalError.message,
        stack: process.env.NODE_ENV === 'development' ? error.originalError.stack : undefined,
      };
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      extensions.stack = error.stack;
    }

    return extensions;
  }

  sanitize(error: GraphQLError): GraphQLError {
    const classification = this.classify(error);
    
    if (classification === 'SystemError' && process.env.NODE_ENV === 'production') {
      return new GraphQLError(
        'An internal error occurred',
        error.nodes,
        error.source,
        error.positions,
        error.path,
        error.originalError,
        {
          ...error.extensions,
          code: 'INTERNAL_ERROR',
          classification: 'SystemError',
        }
      );
    }

    return error;
  }

  classify(error: GraphQLError): IGraphQLErrorExtensions['classification'] {
    const code = this.getErrorCode(error);
    
    // Classify based on error code
    switch (code) {
      case 'GRAPHQL_VALIDATION_FAILED':
      case 'GRAPHQL_PARSE_FAILED':
      case 'BAD_USER_INPUT':
        return 'ValidationError';
      
      case 'UNAUTHENTICATED':
      case 'FORBIDDEN':
      case 'NOT_FOUND':
        return 'UserError';
      
      case 'BUSINESS_RULE_VIOLATION':
      case 'CONSTRAINT_VIOLATION':
        return 'BusinessError';
      
      default:
        return 'SystemError';
    }
  }

  private getErrorCode(error: GraphQLError): string {
    if (error.extensions?.code) {
      return String(error.extensions.code);
    }

    // Infer code from error type
    if (error.message.includes('validation')) {
      return 'GRAPHQL_VALIDATION_FAILED';
    }
    if (error.message.includes('parse') || error.message.includes('syntax')) {
      return 'GRAPHQL_PARSE_FAILED';
    }
    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return 'UNAUTHENTICATED';
    }
    if (error.message.includes('forbidden') || error.message.includes('permission')) {
      return 'FORBIDDEN';
    }
    if (error.message.includes('not found')) {
      return 'NOT_FOUND';
    }

    return 'INTERNAL_ERROR';
  }

  private sanitizeMessage(message: string): string {
    // Remove sensitive information from error messages
    return message
      .replace(/password\s*=\s*[^\s]+/gi, 'password=***')
      .replace(/token\s*=\s*[^\s]+/gi, 'token=***')
      .replace(/key\s*=\s*[^\s]+/gi, 'key=***');
  }

  private sanitizeVariables(variables: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(variables)) {
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('secret')) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

@injectable()
export class ErrorLogger implements IErrorLogger {
  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger
  ) {}

  logError(error: GraphQLError, context?: IErrorContext): void {
    const extensions = (error.extensions || {}) as Partial<IGraphQLErrorExtensions>;
    const classification = extensions.classification || 'SystemError';
    
    const logData = {
      message: error.message,
      code: extensions?.code,
      classification,
      path: error.path,
      operation: context?.operation,
      userId: context?.userId,
      requestId: context?.requestId,
      locations: error.locations,
    };

    // Log at appropriate level based on classification
    switch (classification) {
      case 'ValidationError':
      case 'UserError':
        this.logger.warn('GraphQL user error', logData);
        break;
      
      case 'BusinessError':
        this.logger.info('GraphQL business error', logData);
        break;
      
      case 'SystemError':
      default:
        this.logger.error('GraphQL system error', error, logData);
        break;
    }
  }

  logPerformanceWarning(message: string, metrics: Record<string, any>): void {
    this.logger.warn('GraphQL performance warning', { message, ...metrics });
  }

  logValidationError(errors: GraphQLError[]): void {
    this.logger.warn('GraphQL validation errors', {
      errorCount: errors.length,
      errors: errors.map(e => ({
        message: e.message,
        locations: e.locations,
      })),
    });
  }
}

@injectable()
export class ErrorMonitor implements IErrorMonitor {
  private metrics: IErrorMetrics = {
    totalErrors: 0,
    errorsByType: new Map(),
    errorsByCode: new Map(),
    errorsByPath: new Map(),
    averageResponseTime: 0,
    lastError: new Date(),
    errorRate: 0,
  };

  private startTime = Date.now();
  private totalRequests = 0;

  trackError(error: GraphQLError, context?: IErrorContext): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = new Date();
    this.totalRequests++;

    // Track by classification
    const extensions = (error.extensions || {}) as Partial<IGraphQLErrorExtensions>;
    const classification = extensions.classification || 'SystemError';
    const currentCount = this.metrics.errorsByType.get(classification) || 0;
    this.metrics.errorsByType.set(classification, currentCount + 1);

    // Track by error code
    const code = extensions?.code || 'UNKNOWN';
    const codeCount = this.metrics.errorsByCode.get(code) || 0;
    this.metrics.errorsByCode.set(code, codeCount + 1);

    // Track by path
    if (error.path) {
      const pathStr = error.path.join('.');
      const pathCount = this.metrics.errorsByPath.get(pathStr) || 0;
      this.metrics.errorsByPath.set(pathStr, pathCount + 1);
    }

    // Calculate error rate
    this.metrics.errorRate = this.metrics.totalErrors / this.totalRequests;
  }

  getMetrics(): IErrorMetrics {
    return {
      ...this.metrics,
      errorsByType: new Map(this.metrics.errorsByType),
      errorsByCode: new Map(this.metrics.errorsByCode),
      errorsByPath: new Map(this.metrics.errorsByPath),
    };
  }

  getErrorTrends(timeframe: 'hour' | 'day' | 'week'): Map<string, number> {
    // This would typically connect to a time-series database
    // For now, return empty map
    return new Map();
  }

  isErrorRateHigh(): boolean {
    return this.metrics.errorRate > 0.05; // 5% threshold
  }

  reset(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByCode: new Map(),
      errorsByPath: new Map(),
      averageResponseTime: 0,
      lastError: new Date(),
      errorRate: 0,
    };
    this.totalRequests = 0;
    this.startTime = Date.now();
  }
}

@injectable()
export class ErrorHandler implements IErrorHandler {
  private options: IErrorHandlerOptions = {
    includeStackTrace: process.env.NODE_ENV === 'development',
    includeVariables: process.env.NODE_ENV === 'development',
    sanitizeErrors: process.env.NODE_ENV === 'production',
    logErrors: true,
    enableExtensions: true,
    maskInternalErrors: process.env.NODE_ENV === 'production',
  };

  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.IErrorFormatter) private formatter: IErrorFormatter,
    @inject(GRAPHQL_TOOLKIT_TYPES.IErrorLogger) private errorLogger: IErrorLogger,
    @inject(GRAPHQL_TOOLKIT_TYPES.IErrorMonitor) private monitor: IErrorMonitor
  ) {}

  handleExecutionError(error: GraphQLError, context?: IErrorContext): GraphQLFormattedError {
    // Log the error
    if (this.options.logErrors) {
      this.errorLogger.logError(error, context);
    }

    // Track the error
    this.monitor.trackError(error, context);

    // Sanitize if needed
    const processedError = this.options.sanitizeErrors ? this.formatter.sanitize(error) : error;

    // Format the error
    return this.formatter.format(processedError, context);
  }

  handleValidationErrors(errors: readonly GraphQLError[]): GraphQLFormattedError[] {
    // Log validation errors
    if (this.options.logErrors) {
      this.errorLogger.logValidationError(errors as GraphQLError[]);
    }

    // Track each error
    errors.forEach(error => this.monitor.trackError(error));

    // Format each error
    return errors.map(error => this.formatter.format(error));
  }

  handleSchemaError(error: Error): GraphQLFormattedError {
    const graphqlError = new GraphQLError(
      error.message,
      undefined,
      undefined,
      undefined,
      undefined,
      error,
      {
        code: 'SCHEMA_ERROR',
        classification: 'SystemError',
      }
    );

    return this.handleExecutionError(graphqlError);
  }

  createUserError(message: string, code?: string, metadata?: Record<string, any>): GraphQLError {
    return new GraphQLError(message, undefined, undefined, undefined, undefined, undefined, {
      code: code || 'USER_ERROR',
      classification: 'UserError',
      ...metadata,
    });
  }

  createBusinessError(message: string, code?: string, metadata?: Record<string, any>): GraphQLError {
    return new GraphQLError(message, undefined, undefined, undefined, undefined, undefined, {
      code: code || 'BUSINESS_ERROR',
      classification: 'BusinessError',
      ...metadata,
    });
  }

  createSystemError(error: Error, requestId?: string): GraphQLError {
    const message = this.options.maskInternalErrors 
      ? 'An internal error occurred'
      : error.message;

    return new GraphQLError(message, undefined, undefined, undefined, undefined, error, {
      code: 'INTERNAL_ERROR',
      classification: 'SystemError',
      requestId,
    });
  }

  configure(options: IErrorHandlerOptions): void {
    this.options = { ...this.options, ...options };
  }
}