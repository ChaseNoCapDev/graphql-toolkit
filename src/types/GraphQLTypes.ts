import type { GraphQLSchema, DocumentNode } from 'graphql';
import type { FastifyInstance } from 'fastify';

export interface IGraphQLToolkitConfig {
  enableFederation?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableErrorHandling?: boolean;
  enableSubscriptions?: boolean;
  enableDataLoaders?: boolean;
  performanceThresholds?: {
    maxQueryComplexity?: number;
    maxQueryDepth?: number;
    slowQueryThreshold?: number;
    maxMemoryUsage?: number;
  };
  errorHandling?: {
    includeStackTrace?: boolean;
    sanitizeErrors?: boolean;
    logErrors?: boolean;
  };
  subscriptions?: {
    maxConnections?: number;
    keepAliveInterval?: number;
    connectionTimeout?: number;
  };
  dataLoaders?: {
    enableCaching?: boolean;
    maxBatchSize?: number;
    defaultTTL?: number;
  };
}

export interface IMercuriusPluginOptions {
  app: FastifyInstance;
  schema?: GraphQLSchema;
  gateway?: boolean;
  federationMetadata?: boolean;
  pollingInterval?: number;
  retryServicesCount?: number;
}

export interface IGraphQLContext {
  request: any;
  reply: any;
  user?: any;
  dataloaders?: Map<string, any>;
  requestId?: string;
  startTime?: Date;
  [key: string]: any;
}

export interface IResolverContext extends IGraphQLContext {
  // Extended context for resolvers
  performance?: {
    queryId: string;
    metrics: any;
  };
  cache?: any;
  logger?: any;
}

export interface ISubscriptionContext extends IGraphQLContext {
  // Extended context for subscriptions
  connectionId: string;
  subscriptionId: string;
  userId?: string;
}

export interface IFederationContext {
  supergraph: GraphQLSchema;
  subgraphs: Map<string, any>;
  gateway: any;
}

export type QueryComplexityRule = (args: {
  type: any;
  field: any;
  args: Record<string, any>;
  childComplexity: number;
  introspection: boolean;
}) => number;

export type DepthLimitRule = (depth: number, path: string[]) => boolean;

export interface IGraphQLMiddleware {
  name: string;
  priority: number;
  execute: (context: IResolverContext, next: () => Promise<any>) => Promise<any>;
}

export interface ISchemaDirective {
  name: string;
  locations: string[];
  args?: Record<string, any>;
  implementation: (directiveArgs: Record<string, any>) => any;
}

export interface IGraphQLPlugin {
  name: string;
  version: string;
  install: (app: FastifyInstance, config: IGraphQLToolkitConfig) => Promise<void>;
  uninstall?: (app: FastifyInstance) => Promise<void>;
}

export interface IQueryPlan {
  operation: DocumentNode;
  variables: Record<string, any>;
  fragments: DocumentNode[];
  complexity: number;
  depth: number;
  estimatedCost: number;
  steps: IQueryStep[];
}

export interface IQueryStep {
  id: string;
  type: 'fetch' | 'flatten' | 'compose';
  serviceName?: string;
  requires?: string[];
  provides?: string[];
  operation?: DocumentNode;
  variables?: Record<string, any>;
}

export interface IFederationEntity {
  typeName: string;
  keyFields: string[];
  serviceName: string;
}

export interface ISubgraphHealth {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

export interface IGatewayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  subgraphs: ISubgraphHealth[];
  totalQueries: number;
  errorRate: number;
  averageLatency: number;
  uptime: number;
}