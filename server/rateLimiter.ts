import type { NextFunction, Request, Response } from 'express';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly buckets = new Map<string, number[]>();

  constructor(options: { windowMs: number; maxRequests: number }) {
    this.windowMs = Math.max(1_000, options.windowMs);
    this.maxRequests = Math.max(1, options.maxRequests);
  }

  public check(key: string, now = Date.now()): RateLimitDecision {
    const cleanKey = key || 'anonymous';
    const cutoff = now - this.windowMs;
    const prev = this.buckets.get(cleanKey) || [];
    const recent = prev.filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterMs = Math.max(1_000, oldest + this.windowMs - now);
      this.buckets.set(cleanKey, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil(retryAfterMs / 1000),
      };
    }

    recent.push(now);
    this.buckets.set(cleanKey, recent);

    if (this.buckets.size > 2000) {
      for (const [k, timestamps] of this.buckets.entries()) {
        if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
          this.buckets.delete(k);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      retryAfterSec: 0,
    };
  }
}

export function createRateLimitMiddleware(options: {
  windowMs: number;
  maxRequests: number;
  bucketName: string;
}) {
  const limiter = new SlidingWindowRateLimiter({
    windowMs: options.windowMs,
    maxRequests: options.maxRequests,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${options.bucketName}:${ip}`;
    const decision = limiter.check(key);

    res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSec));
      res.status(429).json({
        error: `تم تجاوز الحد المؤقت لطلبات التوليد. يُرجى الانتظار ${decision.retryAfterSec} ثانية ثم المحاولة مجدداً.`,
        retryAfterSec: decision.retryAfterSec,
      });
      return;
    }
    next();
  };
}
