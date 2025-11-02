import type { GraphQLSchema, GraphQLFieldConfig, FieldNode } from 'graphql';
import type { FastifyInstance } from 'fastify';

export interface ISchemaLayer {
  name: string;
  schema: GraphQLSchema;
  priority: number;
  dependencies?: string[];
}

export interface ICompositionOptions {
  layers: ISchemaLayer[];
  federationEnabled?: boolean;
  mergeStrategy?: 'merge' | 'override' | 'extend';
  validate?: boolean;
  optimizations?: ISchemaOptimizations;
}

export interface ISchemaOptimizations {
  enableQueryComplexityAnalysis?: boolean;
  enableDepthLimiting?: boolean;
  enableFieldLevelCaching?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
}

export interface IComposedSchema {
  schema: GraphQLSchema;
  layers: ISchemaLayer[];
  metadata: ISchemaMetadata;
}

export interface ISchemaMetadata {
  composedAt: Date;
  totalTypes: number;
  totalFields: number;
  layerCount: number;
  optimizations: ISchemaOptimizations;
  conflicts?: ISchemaConflict[];
}

export interface ISchemaConflict {
  type: 'type' | 'field' | 'directive';
  name: string;
  layers: string[];
  resolution: 'merged' | 'overridden' | 'error';
  details: string;
}

export interface ISchemaComposer {
  /**
   * Compose multiple GraphQL schemas into a single layered schema
   */
  compose(options: ICompositionOptions): Promise<IComposedSchema>;

  /**
   * Add a new layer to an existing composed schema
   */
  addLayer(schema: IComposedSchema, layer: ISchemaLayer): Promise<IComposedSchema>;

  /**
   * Remove a layer from a composed schema
   */
  removeLayer(schema: IComposedSchema, layerName: string): Promise<IComposedSchema>;

  /**
   * Validate schema composition for conflicts and errors
   */
  validate(options: ICompositionOptions): Promise<IValidationResult>;

  /**
   * Get composition metadata and statistics
   */
  getMetadata(schema: IComposedSchema): ISchemaMetadata;
}

export interface IValidationResult {
  valid: boolean;
  errors: IValidationError[];
  warnings: IValidationWarning[];
  conflicts: ISchemaConflict[];
}

export interface IValidationError {
  type: 'composition' | 'federation' | 'graphql';
  message: string;
  layer?: string;
  location?: string;
  severity: 'error' | 'warning';
}

export interface IValidationWarning {
  type: 'performance' | 'compatibility' | 'best-practice';
  message: string;
  layer?: string;
  suggestion?: string;
}

export interface IFederationSubgraph {
  name: string;
  url: string;
  schema: GraphQLSchema;
  supergraph?: boolean;
}

export interface IFederationGateway {
  /**
   * Register a subgraph with the gateway
   */
  registerSubgraph(subgraph: IFederationSubgraph): Promise<void>;

  /**
   * Unregister a subgraph from the gateway
   */
  unregisterSubgraph(name: string): Promise<void>;

  /**
   * Get the composed supergraph schema
   */
  getSupergraphSchema(): Promise<GraphQLSchema>;

  /**
   * Validate federation composition
   */
  validateFederation(): Promise<IValidationResult>;
}

export interface IMercuriusConfig {
  app: FastifyInstance;
  schema?: GraphQLSchema;
  federationMetadata?: boolean;
  gateway?: boolean;
  pollingInterval?: number;
  retryServicesCount?: number;
}