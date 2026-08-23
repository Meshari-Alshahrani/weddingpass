/**
 * WeddingPass - Enterprise Distributed & Edge Sliding-Window Rate Limiter
 * Version: 5.9.2
 * Features:
 * 1. High-speed in-memory sliding window with memory bounding (Max 10k active keys).
 * 2. Unbundled Upstash Redis / Vercel KV REST support for multi-instance distributed rate limiting.
 * 3. Graceful zero-latency fallback when distributed store is unconfigured.
 */

interface RateLimitRecord {
  timestamps: number[];
  lastSeen: number;
}

const MAX_TRACKED_KEYS = 10000;
const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodic memory-bounded cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 60000);
      if (record.timestamps.length === 0 || now - record.lastSeen > 300000) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

/**
 * Synchronous High-performance Sliding Window Rate Limiter
 * @param identifier Client IP, Token, or Session ID
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (default: 60000ms = 1 min)
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  // Guard against memory exhaustion
  if (rateLimitMap.size > MAX_TRACKED_KEYS) {
    const firstKey = rateLimitMap.keys().next().value;
    if (firstKey) rateLimitMap.delete(firstKey);
  }

  let record = rateLimitMap.get(identifier);
  if (!record) {
    record = { timestamps: [], lastSeen: now };
    rateLimitMap.set(identifier, record);
  }

  record.lastSeen = now;
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTime = oldestTimestamp + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
    resetTime: now + windowMs,
  };
}

/**
 * Async Distributed Rate Limiter for Vercel Multi-Region Edge Deployments
 * Supports Upstash Redis / Vercel KV via REST without heavy SDK dependencies.
 */
export async function checkDistributedRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    // Fall back to local sliding window
    return checkRateLimit(identifier, maxRequests, windowMs);
  }

  try {
    const windowSec = Math.ceil(windowMs / 1000);
    const key = `rl:${identifier}:${Math.floor(Date.now() / windowMs)}`;

    const res = await fetch(`${kvUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSec],
      ]),
    });

    if (res.ok) {
      const data = await res.json();
      const count = Number(data[0]?.result || 1);
      const remaining = Math.max(0, maxRequests - count);
      return {
        allowed: count <= maxRequests,
        remaining,
        resetTime: Date.now() + windowMs,
      };
    }
  } catch (err) {
    console.warn('Distributed rate limit fallback:', err);
  }

  return checkRateLimit(identifier, maxRequests, windowMs);
}
