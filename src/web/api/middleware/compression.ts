/**
 * Compression Middleware for API Performance
 */

import compression from 'compression';
import { Request, Response } from 'express';

// Enhanced compression configuration
export const compressionMiddleware = compression({
  // Compression level (1-9, 6 is default, good balance of speed/compression)
  level: 6,
  
  // Memory level (1-9, affects memory usage)
  memLevel: 8,
  
  // Compression threshold - only compress responses larger than this
  threshold: 1024, // 1KB
  
  // Custom filter to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if the request has a 'no-compression' header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress images, videos, or already compressed files
    const contentType = res.getHeader('content-type') as string;
    if (contentType) {
      const skipTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-gzip',
        'application/x-compress'
      ];
      
      if (skipTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    // Compress everything else that compression supports
    return compression.filter(req, res);
  },

  // Custom compression for different content types
  strategy: (req: Request, res: Response) => {
    const contentType = res.getHeader('content-type') as string;
    
    if (contentType?.includes('application/json')) {
      // JSON responses - optimize for speed
      return {
        level: 4, // Faster compression for JSON
        windowBits: 15,
        memLevel: 8
      };
    }
    
    if (contentType?.includes('text/html') || contentType?.includes('text/css')) {
      // HTML/CSS - optimize for size
      return {
        level: 8, // Better compression for HTML/CSS
        windowBits: 15,
        memLevel: 8
      };
    }
    
    // Default compression
    return undefined;
  }
});

/**
 * Brotli compression middleware (more efficient than gzip)
 */
export function brotliMiddleware() {
  const zlib = require('zlib');
  
  return (req: Request, res: Response, next: Function) => {
    // Check if client accepts brotli
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    if (!acceptEncoding.includes('br')) {
      return next();
    }

    // Only compress larger responses
    const originalWrite = res.write;
    const originalEnd = res.end;
    const chunks: Buffer[] = [];

    res.write = function(chunk: any) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    };

    res.end = function(chunk?: any) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      
      // Only compress if response is large enough
      if (buffer.length < 1024) {
        res.write = originalWrite;
        res.end = originalEnd;
        return res.end(buffer);
      }

      // Compress with brotli
      zlib.brotliCompress(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length
        }
      }, (err: Error, compressed: Buffer) => {
        res.write = originalWrite;
        res.end = originalEnd;

        if (err) {
          return res.end(buffer);
        }

        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Content-Length', compressed.length);
        res.end(compressed);
      });
    };

    next();
  };
}