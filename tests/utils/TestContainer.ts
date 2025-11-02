import { Container } from 'inversify';
import { MockLogger } from '@chasenocap/test-mocks';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import { GRAPHQL_TOOLKIT_TYPES } from '../../src/types/InjectionTokens.js';

class MockCache implements ICache {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async size(): Promise<number> {
    return this.store.size;
  }

  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    return keys.map(key => this.store.get(key));
  }

  async mset<T>(entries: Array<[string, T]>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      this.store.set(key, value);
    }
  }

  async mdel(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        count++;
      }
    }
    return count;
  }
}

export function createTestContainer(): Container {
  const container = new Container();

  // Mock logger
  const mockLogger = new MockLogger();
  container.bind<ILogger>(GRAPHQL_TOOLKIT_TYPES.ILogger).toConstantValue(mockLogger);

  // Mock cache
  const mockCache = new MockCache();
  container.bind<ICache>(GRAPHQL_TOOLKIT_TYPES.ICache).toConstantValue(mockCache);

  return container;
}