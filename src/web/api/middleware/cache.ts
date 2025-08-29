/**
 * Cache Middleware for API Performance Optimization
 */

import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';
import { logger } from '../../../observability/logger';

// Cache instances for different types of data
const caches = {
  nodes: new NodeCache({ stdTTL: 30, checkperiod: 10 }), // 30 seconds for node data
  vms: new NodeCache({ stdTTL: 10, checkperiod: 5 }), // 10 seconds for VM data
  containers: new NodeCache({ stdTTL: 10, checkperiod: 5 }), // 10 seconds for container data
  resources: new NodeCache({ stdTTL: 60, checkperiod: 15 }), // 1 minute for resource stats
  static: new NodeCache({ stdTTL: 300, checkperiod: 60 }) // 5 minutes for static data
};

interface CacheOptions {
  type: keyof typeof caches;
  keyGenerator?: (req: Request) => string;
  ttl?: number;
  condition?: (req: Request, res: Response) => boolean;
  skipCache?: (req: Request) => boolean;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: CacheOptions) {
  const {
    type,
    keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
    ttl,
    condition = () => true,
    skipCache = (req) => req.method !== 'GET'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests or when condition not met
    if (skipCache(req) || !condition(req, res)) {
      return next();
    }

    const cache = caches[type];
    const cacheKey = keyGenerator(req);

    // Try to get from cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      logger.debug('Cache hit', { cacheKey, type });
      
      // Add cache headers
      res.set({
        'X-Cache': 'HIT',
        'X-Cache-Key': cacheKey,
        'Cache-Control': 'public, max-age=30'
      });
      
      return res.json(cachedData);
    }

    logger.debug('Cache miss', { cacheKey, type });

    // Store original res.json method
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function(body: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Set custom TTL if provided
        if (ttl) {
          cache.set(cacheKey, body, ttl);
        } else {
          cache.set(cacheKey, body);
        }
        
        logger.debug('Response cached', { cacheKey, type, ttl: ttl || 'default' });
        
        // Add cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': 'public, max-age=30'
        });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(type: keyof typeof caches, pattern?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const cache = caches[type];
    
    if (pattern) {
      // Invalidate keys matching pattern
      const keys = cache.keys().filter(key => key.includes(pattern));
      cache.del(keys);
      logger.info('Cache invalidated by pattern', { type, pattern, keysCount: keys.length });
    } else {
      // Invalidate entire cache
      cache.flushAll();
      logger.info('Cache flushed', { type });
    }

    next();
  };
}

/**
 * Conditional cache based on query parameters
 */
export function conditionalCache(type: keyof typeof caches) {
  return cacheMiddleware({
    type,
    keyGenerator: (req) => {
      const query = new URLSearchParams(req.query as any).toString();
      return `${req.method}:${req.path}?${query}`;
    },
    condition: (req) => {
      // Don't cache requests with real-time parameters
      return !req.query.realtime && !req.query.live;
    }
  });
}

/**
 * Cache warming functions
 */
export const cacheWarming = {
  async warmNodeCache(getNodes: () => Promise<any>) {
    try {
      const nodes = await getNodes();
      caches.nodes.set('GET:/api/nodes', nodes, 60);
      logger.info('Node cache warmed');
    } catch (error) {
      logger.error('Failed to warm node cache', { error });
    }
  },

  async warmVMCache(getVMs: () => Promise<any>) {
    try {
      const vms = await getVMs();
      caches.vms.set('GET:/api/vms?page=1&limit=10', vms, 30);
      logger.info('VM cache warmed');
    } catch (error) {
      logger.error('Failed to warm VM cache', { error });
    }
  }
};

/**
 * Cache statistics endpoint
 */
export function getCacheStats() {
  return Object.entries(caches).reduce((stats, [type, cache]) => {
    const cacheStats = cache.getStats();
    return {
      ...stats,
      [type]: {
        keys: cache.keys().length,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
        memoryUsage: process.memoryUsage().heapUsed // Approximate
      }
    };
  }, {});
}

/**
 * Cache cleanup on shutdown
 */
export function cleanupCaches() {
  Object.entries(caches).forEach(([type, cache]) => {
    cache.close();
    logger.info('Cache closed', { type });
  });
}