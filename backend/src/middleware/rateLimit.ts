import type { FastifyRequest } from 'fastify';
import type Redis from 'ioredis';

import { tooManyRequests } from '../utils/httpError';

type RateLimitRule = {
  namespace: string;
  requestsPerMinute: number;
};

export function rateLimitHook(redis: Redis) {
  return async (request: FastifyRequest) => {
    const rule = limitForRequest(request);
    if (!rule) return;

    try {
      const ip = clientIp(request);
      const window = Math.floor(Date.now() / 60000);
      const key = `rate:${window}:${ip}:${rule.namespace}`;

      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 60);
      }

      if (current > rule.requestsPerMinute) {
        throw tooManyRequests(`rate limit exceeded for ${rule.namespace}`);
      }
    } catch {
      // Fail open if Redis is unavailable.
    }
  };
}

function limitForRequest(request: FastifyRequest): RateLimitRule | null {
  const method = request.method.toUpperCase();
  const path = request.url.split('?')[0];

  if (method === 'POST' && path === '/rooms') {
    return { namespace: 'create-room', requestsPerMinute: 1200 };
  }

  if (method === 'POST' && /^\/rooms\/[^/]+\/join$/.test(path)) {
    return { namespace: 'join-room', requestsPerMinute: 2400 };
  }

  if (method === 'POST' && path === '/files/upload-url') {
    return { namespace: 'upload-url', requestsPerMinute: 1800 };
  }

  return null;
}

function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0];
  }

  return request.ip ?? 'unknown';
}
