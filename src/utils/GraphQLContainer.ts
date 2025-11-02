import { Container } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';

// Interfaces
import type { ISchemaComposer, IFederationGateway } from '../interfaces/ISchemaComposer.js';
import type { IDataLoaderFactory, IDataLoaderRegistry } from '../interfaces/IDataLoaderFactory.js';
import type { 
  IErrorHandler, 
  IErrorFormatter, 
  IErrorLogger, 
  IErrorMonitor, 
  IErrorRecovery 
} from '../interfaces/IErrorHandler.js';
import type { 
  ISubscriptionManager, 
  IWebSocketManager, 
  ISubscriptionAuth 
} from '../interfaces/ISubscriptionManager.js';
import type { 
  IPerformanceMonitor, 
  IQueryComplexityAnalyzer, 
  IPerformanceOptimizer 
} from '../interfaces/IPerformanceMonitor.js';

// Implementations
import { SchemaComposer } from '../implementations/SchemaComposer.js';
import { DataLoaderFactory, DataLoaderRegistry } from '../implementations/DataLoaderFactory.js';
import { 
  ErrorHandler, 
  ErrorFormatter, 
  ErrorLogger, 
  ErrorMonitor 
} from '../implementations/ErrorHandler.js';
import { SubscriptionManager } from '../implementations/SubscriptionManager.js';
import { PerformanceMonitor, QueryComplexityAnalyzer } from '../implementations/PerformanceMonitor.js';

// Types
import { GRAPHQL_TOOLKIT_TYPES } from '../types/InjectionTokens.js';
import type { IGraphQLToolkitConfig } from '../types/GraphQLTypes.js';

export interface IGraphQLToolkitOptions {
  config?: IGraphQLToolkitConfig;
  enableLogging?: boolean;
  enableCaching?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export async function createGraphQLContainer(
  options: IGraphQLToolkitOptions = {}
): Promise<Container> {
  const container = new Container();

  const config: IGraphQLToolkitConfig = {
    enableFederation: true,
    enablePerformanceMonitoring: true,
    enableErrorHandling: true,
    enableSubscriptions: true,
    enableDataLoaders: true,
    ...options.config,
  };

  // Note: Core dependencies (ILogger, ICache) should be provided by the consuming application
  // This container only binds the GraphQL-specific services

  // Schema Composition
  if (config.enableFederation) {
    container.bind<ISchemaComposer>(GRAPHQL_TOOLKIT_TYPES.ISchemaComposer)
      .to(SchemaComposer)
      .inSingletonScope();
  }

  // DataLoader Factory
  if (config.enableDataLoaders) {
    container.bind<IDataLoaderRegistry>(GRAPHQL_TOOLKIT_TYPES.IDataLoaderRegistry)
      .to(DataLoaderRegistry)
      .inSingletonScope();

    container.bind<IDataLoaderFactory>(GRAPHQL_TOOLKIT_TYPES.IDataLoaderFactory)
      .to(DataLoaderFactory)
      .inSingletonScope();
  }

  // Error Handling
  if (config.enableErrorHandling) {
    container.bind<IErrorFormatter>(GRAPHQL_TOOLKIT_TYPES.IErrorFormatter)
      .to(ErrorFormatter)
      .inSingletonScope();

    container.bind<IErrorLogger>(GRAPHQL_TOOLKIT_TYPES.IErrorLogger)
      .to(ErrorLogger)
      .inSingletonScope();

    container.bind<IErrorMonitor>(GRAPHQL_TOOLKIT_TYPES.IErrorMonitor)
      .to(ErrorMonitor)
      .inSingletonScope();

    container.bind<IErrorHandler>(GRAPHQL_TOOLKIT_TYPES.IErrorHandler)
      .to(ErrorHandler)
      .inSingletonScope();
  }

  // Subscription Management
  if (config.enableSubscriptions) {
    container.bind<ISubscriptionManager>(GRAPHQL_TOOLKIT_TYPES.ISubscriptionManager)
      .to(SubscriptionManager)
      .inSingletonScope();
  }

  // Performance Monitoring
  if (config.enablePerformanceMonitoring) {
    container.bind<IQueryComplexityAnalyzer>(GRAPHQL_TOOLKIT_TYPES.IQueryComplexityAnalyzer)
      .to(QueryComplexityAnalyzer)
      .inSingletonScope();

    container.bind<IPerformanceMonitor>(GRAPHQL_TOOLKIT_TYPES.IPerformanceMonitor)
      .to(PerformanceMonitor)
      .inSingletonScope();
  }

  return container;
}

// Convenience factory functions
export async function createSchemaComposer(options?: IGraphQLToolkitOptions): Promise<ISchemaComposer> {
  const container = await createGraphQLContainer({
    ...options,
    config: { enableFederation: true, ...options?.config },
  });
  return container.get<ISchemaComposer>(GRAPHQL_TOOLKIT_TYPES.ISchemaComposer);
}

export async function createDataLoaderFactory(options?: IGraphQLToolkitOptions): Promise<IDataLoaderFactory> {
  const container = await createGraphQLContainer({
    ...options,
    config: { enableDataLoaders: true, ...options?.config },
  });
  return container.get<IDataLoaderFactory>(GRAPHQL_TOOLKIT_TYPES.IDataLoaderFactory);
}

export async function createErrorHandler(options?: IGraphQLToolkitOptions): Promise<IErrorHandler> {
  const container = await createGraphQLContainer({
    ...options,
    config: { enableErrorHandling: true, ...options?.config },
  });
  return container.get<IErrorHandler>(GRAPHQL_TOOLKIT_TYPES.IErrorHandler);
}

export async function createSubscriptionManager(options?: IGraphQLToolkitOptions): Promise<ISubscriptionManager> {
  const container = await createGraphQLContainer({
    ...options,
    config: { enableSubscriptions: true, ...options?.config },
  });
  return container.get<ISubscriptionManager>(GRAPHQL_TOOLKIT_TYPES.ISubscriptionManager);
}

export async function createPerformanceMonitor(options?: IGraphQLToolkitOptions): Promise<IPerformanceMonitor> {
  const container = await createGraphQLContainer({
    ...options,
    config: { enablePerformanceMonitoring: true, ...options?.config },
  });
  return container.get<IPerformanceMonitor>(GRAPHQL_TOOLKIT_TYPES.IPerformanceMonitor);
}