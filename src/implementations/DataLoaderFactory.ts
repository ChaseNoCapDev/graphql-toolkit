import { injectable, inject } from 'inversify';
import DataLoader from 'dataloader';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import type {
  IDataLoaderFactory,
  IDataLoaderRegistry,
  IDataLoaderConfig,
  IDataLoaderStats,
  IDataLoaderFactoryOptions,
  IBatchLoadFunction,
  IDataLoaderOptions,
  IDataLoaderMetadata,
} from '../interfaces/IDataLoaderFactory.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../types/InjectionTokens.js';

@injectable()
export class DataLoaderRegistry implements IDataLoaderRegistry {
  private loaders = new Map<string, DataLoader<any, any>>();
  private stats = new Map<string, IDataLoaderStats>();
  private metadata = new Map<string, IDataLoaderMetadata>();

  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger
  ) {}

  register<K, V, C = K>(
    name: string,
    config: IDataLoaderConfig<K, V, C>
  ): DataLoader<K, V, C> {
    if (this.loaders.has(name)) {
      throw new Error(`DataLoader '${name}' is already registered`);
    }

    this.logger.debug('Registering DataLoader', { name, entity: config.metadata?.entity });

    // Create instrumented batch function
    const instrumentedBatchFn = this.createInstrumentedBatchFunction(name, config.batchLoadFn);

    // Create DataLoader with instrumented function
    const loader = new DataLoader(instrumentedBatchFn, config.options);

    // Store metadata and initialize stats
    if (config.metadata) {
      this.metadata.set(name, config.metadata);
    }

    this.stats.set(name, {
      name,
      totalRequests: 0,
      batchedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageBatchSize: 0,
      maxBatchSize: 0,
      totalLatency: 0,
      averageLatency: 0,
      errors: 0,
      createdAt: new Date(),
      lastUsed: new Date(),
    });

    this.loaders.set(name, loader);
    return loader;
  }

  get<K, V, C = K>(name: string): DataLoader<K, V, C> | undefined {
    return this.loaders.get(name);
  }

  has(name: string): boolean {
    return this.loaders.has(name);
  }

  unregister(name: string): boolean {
    const removed = this.loaders.delete(name);
    if (removed) {
      this.stats.delete(name);
      this.metadata.delete(name);
      this.logger.debug('Unregistered DataLoader', { name });
    }
    return removed;
  }

  clear(): void {
    const count = this.loaders.size;
    this.loaders.clear();
    this.stats.clear();
    this.metadata.clear();
    this.logger.debug('Cleared all DataLoaders', { count });
  }

  getNames(): string[] {
    return Array.from(this.loaders.keys());
  }

  getStats(): Map<string, IDataLoaderStats> {
    return new Map(this.stats);
  }

  getStatsFor(name: string): IDataLoaderStats | undefined {
    return this.stats.get(name);
  }

  prime<K, V>(name: string, key: K, value: V): boolean {
    const loader = this.loaders.get(name);
    if (!loader) {
      return false;
    }

    loader.prime(key, value);
    
    // Update cache hit stats
    const stats = this.stats.get(name);
    if (stats) {
      stats.cacheHits++;
    }

    return true;
  }

  clearCache(name: string): boolean {
    const loader = this.loaders.get(name);
    if (!loader) {
      return false;
    }

    loader.clearAll();
    this.logger.debug('Cleared cache for DataLoader', { name });
    return true;
  }

  private createInstrumentedBatchFunction<K, V>(
    name: string,
    originalBatchFn: IBatchLoadFunction<K, V>
  ): IBatchLoadFunction<K, V> {
    return async (keys: readonly K[]): Promise<readonly (V | Error)[]> => {
      const startTime = Date.now();
      const stats = this.stats.get(name);

      if (stats) {
        stats.batchedRequests++;
        stats.totalRequests += keys.length;
        stats.maxBatchSize = Math.max(stats.maxBatchSize, keys.length);
        stats.lastUsed = new Date();
      }

      try {
        const results = await originalBatchFn(keys);
        
        const duration = Date.now() - startTime;
        if (stats) {
          stats.totalLatency += duration;
          stats.averageLatency = stats.totalLatency / stats.batchedRequests;
          stats.averageBatchSize = stats.totalRequests / stats.batchedRequests;
        }

        this.logger.debug('DataLoader batch completed', {
          name,
          batchSize: keys.length,
          duration,
          errors: results.filter(r => r instanceof Error).length,
        });

        return results;
      } catch (error) {
        if (stats) {
          stats.errors++;
        }
        
        this.logger.error('DataLoader batch failed', error as Error, {
          name,
          batchSize: keys.length,
        });
        
        throw error;
      }
    };
  }
}

@injectable()
export class DataLoaderFactory implements IDataLoaderFactory {
  private registry: IDataLoaderRegistry;

  constructor(
    @inject(GRAPHQL_TOOLKIT_TYPES.ILogger) private logger: ILogger,
    @inject(GRAPHQL_TOOLKIT_TYPES.ICache) private cache: ICache,
    @inject(GRAPHQL_TOOLKIT_TYPES.IDataLoaderRegistry) registry: IDataLoaderRegistry
  ) {
    this.registry = registry;
  }

  create<K, V, C = K>(config: IDataLoaderConfig<K, V, C>): DataLoader<K, V, C> {
    return new DataLoader(config.batchLoadFn, config.options);
  }

  createBatchLoader<K, V, C = K>(
    batchLoadFn: IBatchLoadFunction<K, V>,
    options?: IDataLoaderOptions<K, V, C>
  ): DataLoader<K, V, C> {
    const enhancedOptions: IDataLoaderOptions<K, V, C> = {
      batch: true,
      cache: true,
      maxBatchSize: 100,
      ...options,
    };

    this.logger.debug('Creating batch DataLoader', {
      maxBatchSize: enhancedOptions.maxBatchSize,
      cache: enhancedOptions.cache,
    });

    return new DataLoader(batchLoadFn, enhancedOptions);
  }

  createCachedLoader<K, V, C = K>(
    batchLoadFn: IBatchLoadFunction<K, V>,
    options: IDataLoaderOptions<K, V, C> & { redisTTL?: number }
  ): DataLoader<K, V, C> {
    const { redisTTL, ...dataLoaderOptions } = options;

    // Create cache map that uses external cache
    const cacheMap = new Map<C, Promise<V>>();
    const cacheTTL = redisTTL || 300000; // 5 minutes default

    const enhancedBatchFn: IBatchLoadFunction<K, V> = async (keys) => {
      const cacheKeys = keys.map(key => 
        dataLoaderOptions.cacheKeyFn ? dataLoaderOptions.cacheKeyFn(key) : key
      ) as C[];

      // Check cache first
      const cachedResults = await Promise.all(
        cacheKeys.map(async (cacheKey, index) => {
          try {
            const cached = await this.cache.get(String(cacheKey));
            return cached ? { index, value: cached } : null;
          } catch {
            return null;
          }
        })
      );

      // Filter out cache hits
      const missedIndices: number[] = [];
      const missedKeys: K[] = [];
      
      cachedResults.forEach((result, index) => {
        if (!result) {
          missedIndices.push(index);
          missedKeys.push(keys[index]);
        }
      });

      // Fetch missed data
      let fetchedResults: readonly (V | Error)[] = [];
      if (missedKeys.length > 0) {
        fetchedResults = await batchLoadFn(missedKeys);
        
        // Cache the results
        await Promise.all(
          fetchedResults.map(async (result, missedIndex) => {
            if (!(result instanceof Error)) {
              const originalIndex = missedIndices[missedIndex];
              const cacheKey = String(cacheKeys[originalIndex]);
              try {
                await this.cache.set(cacheKey, result, cacheTTL);
              } catch (error) {
                this.logger.warn('Failed to cache DataLoader result', { cacheKey, error });
              }
            }
          })
        );
      }

      // Combine cached and fetched results
      const results: (V | Error)[] = new Array(keys.length);
      let fetchedIndex = 0;

      for (let i = 0; i < keys.length; i++) {
        const cachedResult = cachedResults[i];
        if (cachedResult) {
          results[i] = cachedResult.value;
        } else {
          results[i] = fetchedResults[fetchedIndex++];
        }
      }

      return results;
    };

    const enhancedOptions: IDataLoaderOptions<K, V, C> = {
      ...dataLoaderOptions,
      batch: true,
      cache: true,
      cacheMap,
    };

    this.logger.debug('Creating cached DataLoader', {
      redisTTL: cacheTTL,
      maxBatchSize: enhancedOptions.maxBatchSize,
    });

    return new DataLoader(enhancedBatchFn, enhancedOptions);
  }

  createMonitoredLoader<K, V, C = K>(
    batchLoadFn: IBatchLoadFunction<K, V>,
    metadata: IDataLoaderMetadata,
    options?: IDataLoaderOptions<K, V, C>
  ): DataLoader<K, V, C> {
    const config: IDataLoaderConfig<K, V, C> = {
      batchLoadFn,
      options: {
        batch: true,
        cache: true,
        maxBatchSize: metadata.performance?.expectedBatchSize || 100,
        ...options,
      },
      metadata,
    };

    return this.registry.register(metadata.name, config);
  }

  getRegistry(): IDataLoaderRegistry {
    return this.registry;
  }
}