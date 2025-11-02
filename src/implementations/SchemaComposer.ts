import { injectable, inject } from 'inversify';
import {
  GraphQLSchema,
  buildSchema,
  printSchema,
  isSchema,
  validateSchema,
  type ValidationRule,
} from 'graphql';
import type { ILogger } from '@chasenocap/logger';
import type {
  ISchemaComposer,
  ICompositionOptions,
  IComposedSchema,
  ISchemaLayer,
  ISchemaMetadata,
  IValidationResult,
  ISchemaConflict,
  IValidationError,
  IValidationWarning,
} from '../interfaces/ISchemaComposer.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class SchemaComposer implements ISchemaComposer {
  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger
  ) {}

  async compose(options: ICompositionOptions): Promise<IComposedSchema> {
    this.logger.info('Starting schema composition', {
      layerCount: options.layers.length,
      federationEnabled: options.federationEnabled,
      mergeStrategy: options.mergeStrategy || 'merge',
    });

    try {
      // Validate composition options
      if (options.validate !== false) {
        const validation = await this.validate(options);
        if (!validation.valid) {
          throw new Error(`Schema composition validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Sort layers by priority and dependencies
      const sortedLayers = this.sortLayersByDependencies(options.layers);

      // Compose schemas based on strategy
      const composedSchema = await this.composeSchemas(sortedLayers, options);

      // Generate metadata
      const metadata = this.generateMetadata(composedSchema, sortedLayers, options);

      const result: IComposedSchema = {
        schema: composedSchema,
        layers: sortedLayers,
        metadata,
      };

      this.logger.info('Schema composition completed successfully', {
        totalTypes: metadata.totalTypes,
        totalFields: metadata.totalFields,
        layerCount: metadata.layerCount,
        conflicts: metadata.conflicts?.length || 0,
      });

      return result;
    } catch (error) {
      this.logger.error('Schema composition failed', error as Error);
      throw error;
    }
  }

  async addLayer(schema: IComposedSchema, layer: ISchemaLayer): Promise<IComposedSchema> {
    this.logger.info('Adding layer to composed schema', {
      layerName: layer.name,
      currentLayerCount: schema.layers.length,
    });

    try {
      const newLayers = [...schema.layers, layer];
      const options: ICompositionOptions = {
        layers: newLayers,
        federationEnabled: schema.metadata.optimizations.enableFieldLevelCaching,
        mergeStrategy: 'merge',
        validate: true,
      };

      return await this.compose(options);
    } catch (error) {
      this.logger.error('Failed to add layer to schema', error as Error, {
        layerName: layer.name,
      });
      throw error;
    }
  }

  async removeLayer(schema: IComposedSchema, layerName: string): Promise<IComposedSchema> {
    this.logger.info('Removing layer from composed schema', {
      layerName,
      currentLayerCount: schema.layers.length,
    });

    try {
      const newLayers = schema.layers.filter(layer => layer.name !== layerName);
      
      if (newLayers.length === schema.layers.length) {
        throw new Error(`Layer '${layerName}' not found in composed schema`);
      }

      const options: ICompositionOptions = {
        layers: newLayers,
        federationEnabled: schema.metadata.optimizations.enableFieldLevelCaching,
        mergeStrategy: 'merge',
        validate: true,
      };

      return await this.compose(options);
    } catch (error) {
      this.logger.error('Failed to remove layer from schema', error as Error, {
        layerName,
      });
      throw error;
    }
  }

  async validate(options: ICompositionOptions): Promise<IValidationResult> {
    this.logger.debug('Validating schema composition', {
      layerCount: options.layers.length,
    });

    const errors: IValidationError[] = [];
    const warnings: IValidationWarning[] = [];
    const conflicts: ISchemaConflict[] = [];

    try {
      // Validate individual layers
      for (const layer of options.layers) {
        if (!isSchema(layer.schema)) {
          errors.push({
            type: 'composition',
            message: `Layer '${layer.name}' does not contain a valid GraphQL schema`,
            layer: layer.name,
            severity: 'error',
          });
          continue;
        }

        // Validate GraphQL schema
        const schemaErrors = validateSchema(layer.schema);
        if (schemaErrors.length > 0) {
          errors.push(...schemaErrors.map(error => ({
            type: 'graphql' as const,
            message: error.message,
            layer: layer.name,
            severity: 'error' as const,
          })));
        }
      }

      // Validate dependencies
      this.validateDependencies(options.layers, errors);

      // Detect conflicts
      this.detectConflicts(options.layers, conflicts, warnings);

      // Validate federation if enabled
      if (options.federationEnabled) {
        this.validateFederation(options.layers, errors, warnings);
      }

      const result: IValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
        conflicts,
      };

      this.logger.debug('Schema validation completed', {
        valid: result.valid,
        errorCount: errors.length,
        warningCount: warnings.length,
        conflictCount: conflicts.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Schema validation failed', error as Error);
      throw error;
    }
  }

  getMetadata(schema: IComposedSchema): ISchemaMetadata {
    return schema.metadata;
  }

  private sortLayersByDependencies(layers: ISchemaLayer[]): ISchemaLayer[] {
    const sorted: ISchemaLayer[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (layer: ISchemaLayer) => {
      if (visiting.has(layer.name)) {
        throw new Error(`Circular dependency detected: ${layer.name}`);
      }
      if (visited.has(layer.name)) {
        return;
      }

      visiting.add(layer.name);

      // Visit dependencies first
      if (layer.dependencies) {
        for (const depName of layer.dependencies) {
          const depLayer = layers.find(l => l.name === depName);
          if (depLayer) {
            visit(depLayer);
          }
        }
      }

      visiting.delete(layer.name);
      visited.add(layer.name);
      sorted.push(layer);
    };

    // Sort by priority first, then by dependencies
    const prioritySorted = [...layers].sort((a, b) => a.priority - b.priority);
    
    for (const layer of prioritySorted) {
      visit(layer);
    }

    return sorted;
  }

  private async composeSchemas(layers: ISchemaLayer[], options: ICompositionOptions): Promise<GraphQLSchema> {
    if (layers.length === 0) {
      throw new Error('Cannot compose empty schema layers');
    }

    if (layers.length === 1) {
      return layers[0].schema;
    }

    try {
      // For now, simple composition by taking the last schema
      // In a real implementation, you'd use @graphql-tools/schema
      if (layers.length === 1) {
        return layers[0].schema;
      }
      
      // Simple merge - in practice would use proper schema merging tools
      return layers[layers.length - 1].schema;
    } catch (error) {
      this.logger.error('Failed to compose schemas', error as Error);
      throw new Error(`Schema composition failed: ${(error as Error).message}`);
    }
  }

  private generateMetadata(
    schema: GraphQLSchema,
    layers: ISchemaLayer[],
    options: ICompositionOptions
  ): ISchemaMetadata {
    const typeMap = schema.getTypeMap();
    const types = Object.keys(typeMap).filter(name => !name.startsWith('__'));
    
    // Count fields across all types
    let totalFields = 0;
    for (const typeName of types) {
      const type = typeMap[typeName];
      if ('getFields' in type && typeof type.getFields === 'function') {
        const fields = type.getFields();
        totalFields += Object.keys(fields).length;
      }
    }

    return {
      composedAt: new Date(),
      totalTypes: types.length,
      totalFields,
      layerCount: layers.length,
      optimizations: options.optimizations || {},
      conflicts: [], // Would be populated by conflict detection
    };
  }

  private validateDependencies(layers: ISchemaLayer[], errors: IValidationError[]): void {
    const layerNames = new Set(layers.map(l => l.name));

    for (const layer of layers) {
      if (layer.dependencies) {
        for (const depName of layer.dependencies) {
          if (!layerNames.has(depName)) {
            errors.push({
              type: 'composition',
              message: `Layer '${layer.name}' depends on '${depName}' which is not available`,
              layer: layer.name,
              severity: 'error',
            });
          }
        }
      }
    }
  }

  private detectConflicts(
    layers: ISchemaLayer[],
    conflicts: ISchemaConflict[],
    warnings: IValidationWarning[]
  ): void {
    const typeOccurrences = new Map<string, string[]>();
    const fieldOccurrences = new Map<string, string[]>();

    // Track type and field occurrences across layers
    for (const layer of layers) {
      const typeMap = layer.schema.getTypeMap();
      
      for (const [typeName, type] of Object.entries(typeMap)) {
        if (typeName.startsWith('__')) continue;

        // Track type occurrences
        if (!typeOccurrences.has(typeName)) {
          typeOccurrences.set(typeName, []);
        }
        typeOccurrences.get(typeName)!.push(layer.name);

        // Track field occurrences
        if ('getFields' in type && typeof type.getFields === 'function') {
          const fields = type.getFields();
          for (const fieldName of Object.keys(fields)) {
            const fullFieldName = `${typeName}.${fieldName}`;
            if (!fieldOccurrences.has(fullFieldName)) {
              fieldOccurrences.set(fullFieldName, []);
            }
            fieldOccurrences.get(fullFieldName)!.push(layer.name);
          }
        }
      }
    }

    // Detect conflicts
    for (const [typeName, layerNames] of typeOccurrences) {
      if (layerNames.length > 1) {
        conflicts.push({
          type: 'type',
          name: typeName,
          layers: layerNames,
          resolution: 'merged',
          details: `Type '${typeName}' appears in multiple layers: ${layerNames.join(', ')}`,
        });
      }
    }

    for (const [fieldName, layerNames] of fieldOccurrences) {
      if (layerNames.length > 1) {
        warnings.push({
          type: 'compatibility',
          message: `Field '${fieldName}' appears in multiple layers: ${layerNames.join(', ')}`,
          suggestion: 'Ensure field types are compatible across layers',
        });
      }
    }
  }

  private validateFederation(
    layers: ISchemaLayer[],
    errors: IValidationError[],
    warnings: IValidationWarning[]
  ): void {
    // Federation-specific validation would go here
    // For now, just add a placeholder warning
    warnings.push({
      type: 'best-practice',
      message: 'Federation validation is not fully implemented',
      suggestion: 'Implement comprehensive federation validation',
    });
  }
}