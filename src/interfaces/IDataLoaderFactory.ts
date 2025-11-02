import type DataLoader from 'dataloader';

export interface IBatchLoadFunction<K, V> {
  (keys: readonly K[]): Promise<readonly (V | Error)[]>;
}

export interface IDataLoaderOptions<K, V, C = K> {
  batch?: boolean;
  maxBatchSize?: number;
  cache?: boolean;
  cacheKeyFn?: (key: K) => C;
  cacheMap?: Map<C, Promise<V>>;
  batchScheduleFn?: (callback: () => void) => void;
  name?: string;
}

export interface IDataLoaderConfig<K, V, C = K> {
  batchLoadFn: IBatchLoadFunction<K, V>;
  options?: IDataLoaderOptions<K, V, C>;
  metadata?: IDataLoaderMetadata;
}

export interface IDataLoaderMetadata {
  name: string;
  description?: string;
  entity: string;
  cacheTTL?: number;
  tags?: string[];
  performance?: {
    expectedBatchSize?: number;
    maxLatency?: number;
  };
}

export interface IDataLoaderStats {
  name: string;
  totalRequests: number;
  batchedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageBatchSize: number;
  maxBatchSize: number;
  totalLatency: number;
  averageLatency: number;
  errors: number;
  createdAt: Date;
  lastUsed: Date;
}

export interface IDataLoaderRegistry {
  /**
   * Register a new DataLoader with the registry
   */
  register<K, V, C = K>(
    name: string,
    config: IDataLoaderConfig<K, V, C>
  ): DataLoader<K, V, C>;

  /**
   * Get an existing DataLoader by name
   */
  get<K, V, C = K>(name: string): DataLoader<K, V, C> | undefined;

  /**
   * Check if a DataLoader exists
   */
  has(name: string): boolean;

  /**
   * Remove a DataLoader from the registry
   */
  unregister(name: string): boolean;

  /**
   * Clear all DataLoaders
   */
  clear(): void;

  /**
   * Get all registered DataLoader names
   */
  getNames(): string[];

  /**
   * Get performance statistics for all DataLoaders
   */
  getStats(): Map<string, IDataLoaderStats>;

  /**
   * Get performance statistics for a specific DataLoader
   */
  getStatsFor(name: string): IDataLoaderStats | undefined;

  /**
   * Prime a DataLoader's cache with data
   */
  prime<K, V>(name: string, key: K, value: V): boolean;

  /**
   * Clear cache for a specific DataLoader
   */
  clearCache(name: string): boolean;
}

export interface IDataLoaderFactory {
  /**
   * Create a new DataLoader instance
   */
  create<K, V, C = K>(config: IDataLoaderConfig<K, V, C>): DataLoader<K, V, C>;

  /**
   * Create a DataLoader with automatic batching optimization
   */
  createBatchLoader<K, V, C = K>(
    batchLoadFn: IBatchLoadFunction<K, V>,
    options?: IDataLoaderOptions<K, V, C>
  ): DataLoader<K, V, C>;

  /**
   * Create a DataLoader with Redis caching
   */
  createCachedLoader<K, V, C = K>(
    batchLoadFn: IBatchLoadFunction<K, V>,
    options: IDataLoaderOptions<K, V, C> & { redisTTL?: number }
  ): DataLoader<K, V, C>;

  /**
   * Create a DataLoader with performance monitoring
   */
  createMonitoredLoader<K, V, C = K>(
    batchLoadFn: IBatchLoadFunction<K, V>,
    metadata: IDataLoaderMetadata,
    options?: IDataLoaderOptions<K, V, C>
  ): DataLoader<K, V, C>;

  /**
   * Get the global DataLoader registry
   */
  getRegistry(): IDataLoaderRegistry;
}

export interface IGraphQLContext {
  dataloaders: Map<string, DataLoader<any, any>>;
  user?: any;
  request?: any;
  reply?: any;
  [key: string]: any;
}

export interface IDataLoaderFactoryOptions {
  enableMonitoring?: boolean;
  enableCaching?: boolean;
  globalRegistry?: boolean;
  defaultTTL?: number;
  maxBatchSize?: number;
}