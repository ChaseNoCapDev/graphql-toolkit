import { describe, it, expect, beforeEach, vi } from 'vitest';
import DataLoader from 'dataloader';
import { DataLoaderFactory, DataLoaderRegistry } from '../../src/implementations/DataLoaderFactory.js';
import type { IDataLoaderFactory, IDataLoaderRegistry, IBatchLoadFunction } from '../../src/interfaces/IDataLoaderFactory.js';
import { createTestContainer } from '../utils/TestContainer.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../../src/types/InjectionTokens.js';

describe('DataLoaderFactory', () => {
  let factory: IDataLoaderFactory;

  beforeEach(async () => {
    const container = createTestContainer();
    container.bind<IDataLoaderRegistry>(GRAPHQL_TOOLKIT_TYPES.IDataLoaderRegistry).to(DataLoaderRegistry);
    container.bind<IDataLoaderFactory>(GRAPHQL_TOOLKIT_TYPES.IDataLoaderFactory).to(DataLoaderFactory);
    factory = container.get<IDataLoaderFactory>(GRAPHQL_TOOLKIT_TYPES.IDataLoaderFactory);
  });

  describe('createBatchLoader', () => {
    it('should create a DataLoader with batching enabled', async () => {
      const batchFn: IBatchLoadFunction<number, string> = async (keys) => {
        return keys.map(key => `value-${key}`);
      };

      const loader = factory.createBatchLoader(batchFn, {
        maxBatchSize: 10,
        cache: true,
      });

      expect(loader).toBeInstanceOf(DataLoader);

      // Test batching
      const promise1 = loader.load(1);
      const promise2 = loader.load(2);
      const promise3 = loader.load(3);

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual(['value-1', 'value-2', 'value-3']);
    });

    it('should handle batch load errors gracefully', async () => {
      const batchFn: IBatchLoadFunction<number, string> = async (keys) => {
        return keys.map(key => {
          if (key === 2) {
            return new Error(`Error loading key: ${key}`);
          }
          return `value-${key}`;
        });
      };

      const loader = factory.createBatchLoader(batchFn);

      const promise1 = loader.load(1);
      const promise2 = loader.load(2);
      const promise3 = loader.load(3);

      const result1 = await promise1;
      expect(result1).toBe('value-1');

      await expect(promise2).rejects.toThrow('Error loading key: 2');

      const result3 = await promise3;
      expect(result3).toBe('value-3');
    });
  });

  describe('createMonitoredLoader', () => {
    it('should create a DataLoader with monitoring', async () => {
      const batchFn: IBatchLoadFunction<string, { id: string; name: string }> = async (keys) => {
        return keys.map(key => ({ id: key, name: `Name ${key}` }));
      };

      const metadata = {
        name: 'userLoader',
        description: 'Loads user data by ID',
        entity: 'User',
        cacheTTL: 300000,
        performance: {
          expectedBatchSize: 5,
          maxLatency: 100,
        },
      };

      const loader = factory.createMonitoredLoader(batchFn, metadata, {
        maxBatchSize: 10,
      });

      expect(loader).toBeInstanceOf(DataLoader);

      // Test the loader
      const result = await loader.load('user1');
      expect(result).toEqual({ id: 'user1', name: 'Name user1' });

      // Check if registry has the loader
      const registry = factory.getRegistry();
      expect(registry.has('userLoader')).toBe(true);
      
      const stats = registry.getStatsFor('userLoader');
      expect(stats).toBeDefined();
      expect(stats?.name).toBe('userLoader');
    });

    it('should track performance statistics', async () => {
      const batchFn: IBatchLoadFunction<number, string> = async (keys) => {
        // Simulate some delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return keys.map(key => `result-${key}`);
      };

      const metadata = {
        name: 'perfLoader',
        entity: 'TestEntity',
      };

      const loader = factory.createMonitoredLoader(batchFn, metadata);

      // Make several loads to generate stats
      await Promise.all([
        loader.load(1),
        loader.load(2),
        loader.load(3),
      ]);

      const registry = factory.getRegistry();
      const stats = registry.getStatsFor('perfLoader');

      expect(stats).toBeDefined();
      expect(stats!.totalRequests).toBe(3);
      expect(stats!.batchedRequests).toBe(1);
      expect(stats!.maxBatchSize).toBe(3);
      expect(stats!.averageBatchSize).toBe(3);
    });
  });

  describe('DataLoaderRegistry', () => {
    it('should register and retrieve loaders', async () => {
      const batchFn: IBatchLoadFunction<string, string> = async (keys) => {
        return keys.map(key => `processed-${key}`);
      };

      const registry = factory.getRegistry();

      const loader = registry.register('testLoader', {
        batchLoadFn: batchFn,
        metadata: {
          name: 'testLoader',
          entity: 'Test',
        },
      });

      expect(loader).toBeInstanceOf(DataLoader);
      expect(registry.has('testLoader')).toBe(true);
      expect(registry.get('testLoader')).toBe(loader);
    });

    it('should prevent duplicate registrations', async () => {
      const batchFn: IBatchLoadFunction<string, string> = async (keys) => {
        return keys.map(key => key);
      };

      const registry = factory.getRegistry();

      registry.register('duplicateLoader', {
        batchLoadFn: batchFn,
        metadata: { name: 'duplicateLoader', entity: 'Test' },
      });

      expect(() => {
        registry.register('duplicateLoader', {
          batchLoadFn: batchFn,
          metadata: { name: 'duplicateLoader', entity: 'Test' },
        });
      }).toThrow(/already registered/);
    });

    it('should unregister loaders', async () => {
      const batchFn: IBatchLoadFunction<string, string> = async (keys) => {
        return keys.map(key => key);
      };

      const registry = factory.getRegistry();

      registry.register('tempLoader', {
        batchLoadFn: batchFn,
        metadata: { name: 'tempLoader', entity: 'Test' },
      });

      expect(registry.has('tempLoader')).toBe(true);

      const removed = registry.unregister('tempLoader');
      expect(removed).toBe(true);
      expect(registry.has('tempLoader')).toBe(false);
    });

    it('should clear all loaders', async () => {
      const batchFn: IBatchLoadFunction<string, string> = async (keys) => {
        return keys.map(key => key);
      };

      const registry = factory.getRegistry();

      registry.register('loader1', {
        batchLoadFn: batchFn,
        metadata: { name: 'loader1', entity: 'Test' },
      });

      registry.register('loader2', {
        batchLoadFn: batchFn,
        metadata: { name: 'loader2', entity: 'Test' },
      });

      expect(registry.getNames()).toHaveLength(2);

      registry.clear();
      expect(registry.getNames()).toHaveLength(0);
    });

    it('should prime cache', async () => {
      const batchFn = vi.fn<[readonly string[]], Promise<readonly string[]>>(async (keys) => {
        return keys.map(key => `loaded-${key}`);
      });

      const registry = factory.getRegistry();

      const loader = registry.register('cacheLoader', {
        batchLoadFn: batchFn,
        metadata: { name: 'cacheLoader', entity: 'Test' },
      });

      // Prime the cache
      const primed = registry.prime('cacheLoader', 'test1', 'primed-test1');
      expect(primed).toBe(true);

      // Load the primed value
      const result = await loader.load('test1');
      expect(result).toBe('primed-test1');

      // Batch function should not have been called for primed value
      expect(batchFn).not.toHaveBeenCalled();
    });
  });
});