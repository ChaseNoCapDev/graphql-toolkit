import { describe, it, expect, beforeEach } from 'vitest';
import { parse, buildSchema } from 'graphql';
import { PerformanceMonitor, QueryComplexityAnalyzer } from '../../src/implementations/PerformanceMonitor.js';
import type { IPerformanceMonitor, IQueryComplexityAnalyzer } from '../../src/interfaces/IPerformanceMonitor.js';
import { createTestContainer } from '../utils/TestContainer.js';
import { GRAPHQL_TOOLKIT_TYPES } from '../../src/types/InjectionTokens.js';

describe('PerformanceMonitor', () => {
  let monitor: IPerformanceMonitor;

  beforeEach(async () => {
    const container = createTestContainer();
    container.bind<IQueryComplexityAnalyzer>(GRAPHQL_TOOLKIT_TYPES.IQueryComplexityAnalyzer).to(QueryComplexityAnalyzer);
    container.bind<IPerformanceMonitor>(GRAPHQL_TOOLKIT_TYPES.IPerformanceMonitor).to(PerformanceMonitor);
    monitor = container.get<IPerformanceMonitor>(GRAPHQL_TOOLKIT_TYPES.IPerformanceMonitor);
  });

  describe('Query Complexity Analysis', () => {
    it('should calculate basic query complexity', async () => {
      const query = parse(`
        query {
          user(id: "1") {
            id
            name
            email
          }
        }
      `);

      const metrics = monitor.startQuery('test-1', query);
      expect(metrics.complexity).toBeGreaterThan(0);
      expect(metrics.fieldCount).toBe(4); // user, id, name, email
      expect(metrics.depth).toBeGreaterThan(0);
    });

    it('should calculate complexity for nested queries', async () => {
      const query = parse(`
        query {
          user(id: "1") {
            id
            name
            posts {
              id
              title
              comments {
                id
                content
                author {
                  id
                  name
                }
              }
            }
          }
        }
      `);

      const metrics = monitor.startQuery('test-2', query);
      expect(metrics.complexity).toBeGreaterThan(5);
      expect(metrics.depth).toBeGreaterThan(3);
      expect(metrics.fieldCount).toBeGreaterThan(7);
    });

    it('should detect list fields and add complexity', async () => {
      const query = parse(`
        query {
          users {
            id
            name
          }
          allPosts {
            id
            title
          }
        }
      `);

      const metrics = monitor.startQuery('test-3', query);
      // Should add extra complexity for 'users' and 'allPosts' (list fields)
      expect(metrics.complexity).toBeGreaterThan(4);
    });
  });

  describe('Query Monitoring', () => {
    it('should track query execution time', async () => {
      const query = parse(`
        query {
          hello
        }
      `);

      const metrics = monitor.startQuery('timing-test', query);
      expect(metrics.startTime).toBeInstanceOf(Date);
      expect(metrics.endTime).toBeUndefined();
      expect(metrics.duration).toBeUndefined();

      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 10));

      monitor.endQuery('timing-test');

      const stats = monitor.getStats();
      expect(stats.totalQueries).toBe(1);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
    });

    it('should track errors in queries', async () => {
      const query = parse(`
        query {
          user(id: "1") {
            id
          }
        }
      `);

      monitor.startQuery('error-test', query);
      
      const errors = [new Error('Test error')];
      monitor.endQuery('error-test', errors);

      const stats = monitor.getStats();
      expect(stats.errorRate).toBeGreaterThan(0);
    });

    it('should identify slow queries', async () => {
      const query = parse(`
        query {
          slowOperation
        }
      `);

      // Set low threshold for testing
      monitor.setThresholds({ slowQueryThreshold: 5 });

      monitor.startQuery('slow-test', query);
      
      // Simulate slow processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      monitor.endQuery('slow-test');

      const slowQueries = monitor.getSlowQueries();
      expect(slowQueries.length).toBeGreaterThan(0);
      expect(slowQueries[0].queryId).toBe('slow-test');

      const alerts = monitor.getAlerts();
      expect(alerts.some(alert => alert.type === 'threshold')).toBe(true);
    });
  });

  describe('Field-level Monitoring', () => {
    it('should track field resolver performance', () => {
      const mockInfo = {
        fieldName: 'user',
        parentType: { name: 'Query' },
        path: { key: 'user', prev: null },
      } as any;

      const fieldMetrics = monitor.startField('field-test', mockInfo);
      expect(fieldMetrics.fieldName).toBe('user');
      expect(fieldMetrics.typeName).toBe('Query');
      expect(fieldMetrics.startTime).toBeInstanceOf(Date);

      monitor.endField('field-test', ['user']);
      // Field metrics are tracked internally
    });

    it('should record cache events', () => {
      const query = parse(`query { user { id } }`);
      
      monitor.startQuery('cache-test', query);
      monitor.recordCacheEvent('cache-test', ['user'], true); // cache hit
      monitor.recordCacheEvent('cache-test', ['user', 'profile'], false); // cache miss
      monitor.endQuery('cache-test');

      const stats = monitor.getStats();
      expect(stats.cacheHitRate).toBeDefined();
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });

    it('should record DataLoader batches', () => {
      const query = parse(`query { users { id } }`);
      
      monitor.startQuery('dataloader-test', query);
      monitor.recordDataLoaderBatch('dataloader-test', 'userLoader', 5, 2);
      monitor.endQuery('dataloader-test');

      const stats = monitor.getStats();
      expect(stats.dataLoaderStats.totalBatches).toBeGreaterThan(0);
    });
  });

  describe('Performance Statistics', () => {
    it('should provide comprehensive performance stats', async () => {
      // Generate some test data
      const queries = [
        parse(`query { user { id } }`),
        parse(`query { posts { title } }`),
        parse(`query { complex { nested { deep { field } } } }`),
      ];

      for (let i = 0; i < queries.length; i++) {
        monitor.startQuery(`stats-test-${i}`, queries[i]);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        monitor.endQuery(`stats-test-${i}`);
      }

      const stats = monitor.getStats();
      
      expect(stats.totalQueries).toBe(3);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBe(0); // No errors in this test
      expect(stats.memoryUsage.current).toBeGreaterThan(0);
      expect(stats.concurrentQueries.current).toBe(0); // All finished
    });

    it('should filter stats by timeframe', async () => {
      const query = parse(`query { test }`);
      
      monitor.startQuery('timeframe-test', query);
      monitor.endQuery('timeframe-test');

      const hourStats = monitor.getStats('hour');
      const dayStats = monitor.getStats('day');

      expect(hourStats.totalQueries).toBe(dayStats.totalQueries);
      expect(hourStats.totalQueries).toBe(1);
    });
  });

  describe('Performance Alerts', () => {
    it('should generate alerts for threshold violations', async () => {
      const complexQuery = parse(`
        query {
          users {
            id
            posts {
              comments {
                author {
                  profile {
                    settings {
                      notifications {
                        email
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `);

      // Set low thresholds to trigger alerts
      monitor.setThresholds({
        maxQueryComplexity: 5,
        maxQueryDepth: 3,
      });

      monitor.startQuery('alert-test', complexQuery);
      monitor.endQuery('alert-test');

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const highSeverityAlerts = monitor.getAlerts('high');
      expect(highSeverityAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate JSON report', async () => {
      const query = parse(`query { test }`);
      
      monitor.startQuery('report-test', query);
      monitor.endQuery('report-test');

      const report = await monitor.generateReport('hour', 'json');
      expect(report).toBeDefined();
      
      const reportData = JSON.parse(report);
      expect(reportData.timestamp).toBeDefined();
      expect(reportData.timeframe).toBe('hour');
      expect(reportData.stats).toBeDefined();
    });

    it('should generate CSV report', async () => {
      const query = parse(`query { test }`);
      
      monitor.startQuery('csv-test', query);
      monitor.endQuery('csv-test');

      const report = await monitor.generateReport('day', 'csv');
      expect(report).toContain('timestamp,metric,value');
      expect(report).toContain('totalQueries');
    });

    it('should generate HTML report', async () => {
      const query = parse(`query { test }`);
      
      monitor.startQuery('html-test', query);
      monitor.endQuery('html-test');

      const report = await monitor.generateReport('week', 'html');
      expect(report).toContain('<html>');
      expect(report).toContain('Performance Report');
      expect(report).toContain('Total Queries');
    });
  });
});