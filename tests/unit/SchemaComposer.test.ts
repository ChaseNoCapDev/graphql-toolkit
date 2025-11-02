import { describe, it, expect, beforeEach } from 'vitest';
import { buildSchema, GraphQLSchema } from 'graphql';
import { SchemaComposer } from '../../src/implementations/SchemaComposer.js';
import type { ISchemaComposer, ISchemaLayer, ICompositionOptions } from '../../src/interfaces/ISchemaComposer.js';
import { createTestContainer } from '../utils/TestContainer.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../../src/types/InjectionTokens.js';

describe('SchemaComposer', () => {
  let schemaComposer: ISchemaComposer;

  beforeEach(async () => {
    const container = createTestContainer();
    container.bind<ISchemaComposer>(GRAPHQL_TOOLKIT_TYPES.ISchemaComposer).to(SchemaComposer);
    schemaComposer = container.get<ISchemaComposer>(GRAPHQL_TOOLKIT_TYPES.ISchemaComposer);
  });

  describe('compose', () => {
    it('should compose a single schema layer', async () => {
      const schema = buildSchema(`
        type Query {
          hello: String
        }
      `);

      const layer: ISchemaLayer = {
        name: 'base',
        schema,
        priority: 1,
      };

      const options: ICompositionOptions = {
        layers: [layer],
      };

      const result = await schemaComposer.compose(options);

      expect(result.schema).toBeDefined();
      expect(result.layers).toHaveLength(1);
      expect(result.metadata.totalTypes).toBeGreaterThan(0);
      expect(result.metadata.layerCount).toBe(1);
    });

    it('should compose multiple schema layers', async () => {
      const baseSchema = buildSchema(`
        type Query {
          hello: String
        }
      `);

      const userSchema = buildSchema(`
        type Query {
          user(id: ID!): User
        }
        
        type User {
          id: ID!
          name: String!
        }
      `);

      const layers: ISchemaLayer[] = [
        {
          name: 'base',
          schema: baseSchema,
          priority: 1,
        },
        {
          name: 'user',
          schema: userSchema,
          priority: 2,
        },
      ];

      const options: ICompositionOptions = {
        layers,
        mergeStrategy: 'merge',
      };

      const result = await schemaComposer.compose(options);

      expect(result.schema).toBeDefined();
      expect(result.layers).toHaveLength(2);
      expect(result.metadata.layerCount).toBe(2);
      expect(result.metadata.totalTypes).toBeGreaterThan(2); // Query + User + scalars
    });

    it('should handle schema with dependencies', async () => {
      const baseSchema = buildSchema(`
        type Query {
          hello: String
        }
      `);

      const dependentSchema = buildSchema(`
        type Query {
          user: User
        }
        
        type User {
          id: ID!
          name: String!
        }
      `);

      const layers: ISchemaLayer[] = [
        {
          name: 'base',
          schema: baseSchema,
          priority: 1,
        },
        {
          name: 'user',
          schema: dependentSchema,
          priority: 2,
          dependencies: ['base'],
        },
      ];

      const options: ICompositionOptions = {
        layers,
        validate: true,
      };

      const result = await schemaComposer.compose(options);

      expect(result.schema).toBeDefined();
      expect(result.layers[0].name).toBe('base'); // Should be sorted by dependencies
      expect(result.layers[1].name).toBe('user');
    });

    it('should throw error for circular dependencies', async () => {
      const schema1 = buildSchema(`type Query { hello: String }`);
      const schema2 = buildSchema(`type Query { world: String }`);

      const layers: ISchemaLayer[] = [
        {
          name: 'layer1',
          schema: schema1,
          priority: 1,
          dependencies: ['layer2'],
        },
        {
          name: 'layer2',
          schema: schema2,
          priority: 2,
          dependencies: ['layer1'],
        },
      ];

      const options: ICompositionOptions = {
        layers,
      };

      await expect(schemaComposer.compose(options)).rejects.toThrow(/circular dependency/i);
    });
  });

  describe('validate', () => {
    it('should validate schema composition successfully', async () => {
      const schema = buildSchema(`
        type Query {
          hello: String
        }
      `);

      const layer: ISchemaLayer = {
        name: 'valid',
        schema,
        priority: 1,
      };

      const options: ICompositionOptions = {
        layers: [layer],
      };

      const result = await schemaComposer.validate(options);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing dependencies', async () => {
      const schema = buildSchema(`type Query { hello: String }`);

      const layer: ISchemaLayer = {
        name: 'dependent',
        schema,
        priority: 1,
        dependencies: ['missing'],
      };

      const options: ICompositionOptions = {
        layers: [layer],
      };

      const result = await schemaComposer.validate(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('missing');
    });
  });

  describe('addLayer', () => {
    it('should add a new layer to existing composition', async () => {
      const baseSchema = buildSchema(`
        type Query {
          hello: String
        }
      `);

      const layer: ISchemaLayer = {
        name: 'base',
        schema: baseSchema,
        priority: 1,
      };

      const options: ICompositionOptions = {
        layers: [layer],
      };

      const composed = await schemaComposer.compose(options);

      const newSchema = buildSchema(`
        type Query {
          user: User
        }
        
        type User {
          id: ID!
          name: String!
        }
      `);

      const newLayer: ISchemaLayer = {
        name: 'user',
        schema: newSchema,
        priority: 2,
      };

      const result = await schemaComposer.addLayer(composed, newLayer);

      expect(result.layers).toHaveLength(2);
      expect(result.metadata.layerCount).toBe(2);
      expect(result.layers.some(l => l.name === 'user')).toBe(true);
    });
  });

  describe('removeLayer', () => {
    it('should remove a layer from existing composition', async () => {
      const baseSchema = buildSchema(`type Query { hello: String }`);
      const userSchema = buildSchema(`type Query { user: User } type User { id: ID! }`);

      const layers: ISchemaLayer[] = [
        {
          name: 'base',
          schema: baseSchema,
          priority: 1,
        },
        {
          name: 'user',
          schema: userSchema,
          priority: 2,
        },
      ];

      const options: ICompositionOptions = {
        layers,
      };

      const composed = await schemaComposer.compose(options);
      const result = await schemaComposer.removeLayer(composed, 'user');

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].name).toBe('base');
    });

    it('should throw error when removing non-existent layer', async () => {
      const schema = buildSchema(`type Query { hello: String }`);

      const layer: ISchemaLayer = {
        name: 'base',
        schema,
        priority: 1,
      };

      const options: ICompositionOptions = {
        layers: [layer],
      };

      const composed = await schemaComposer.compose(options);

      await expect(schemaComposer.removeLayer(composed, 'nonexistent')).rejects.toThrow(/not found/i);
    });
  });
});