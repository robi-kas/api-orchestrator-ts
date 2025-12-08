import { FailureType, RateLimitInfo, RetryPolicy, StepConfig } from '../types';

const DEFAULT_BACKOFF = 1.8;
const DEFAULT_BASE_DELAY = 300;
const DEFAULT_MAX_DELAY = 10_000;

export const defaultRetryPolicy: RetryPolicy = {
  retries: 2,
  backoffFactor: DEFAULT_BACKOFF,
  baseDelay: DEFAULT_BASE_DELAY,
  maxDelay: DEFAULT_MAX_DELAY,
  jitter: true,
};

export function createStep(
  name: string,
  fn: StepConfig['execute'],
  options: Partial<Omit<StepConfig, 'name' | 'execute'>> = {},
): StepConfig {
  return {
    name,
    execute: fn,
    retries: options.retries,
    timeout: options.timeout,
    delay: options.delay,
    fallbackValue: options.fallbackValue,
    fallbackStep: options.fallbackStep,
    parallel: options.parallel,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoffDelay(policy: RetryPolicy, attempt: number, stepDelay?: number): number {
  const base = stepDelay ?? policy.baseDelay;
  const exp = Math.pow(policy.backoffFactor, attempt - 1);
  const withBackoff = Math.min(policy.maxDelay, base * exp);
  if (!policy.jitter) return withBackoff;
  const jitter = Math.random() * base;
  return Math.min(policy.maxDelay, withBackoff + jitter);
}

export function detectRateLimit(error: any): RateLimitInfo | null {
  if (!error) return null;
  const status = error.status ?? error.code ?? error?.response?.status;
  const headers = error?.headers ?? error?.response?.headers;
  const retryAfter = headers?.['retry-after'] ?? headers?.['Retry-After'];
  const reset = headers?.['x-ratelimit-reset'] ?? headers?.['X-RateLimit-Reset'];
  const remaining = headers?.['x-ratelimit-remaining'] ?? headers?.['X-RateLimit-Remaining'];

  if (status === 429 || retryAfter || reset || remaining) {
    const retryAfterMs = retryAfter ? parseFloat(retryAfter) * 1000 : undefined;
    const resetInMs = reset ? Math.max(0, parseFloat(reset) * 1000 - Date.now()) : undefined;
    const info: RateLimitInfo = {
      retryAfterMs,
      resetInMs,
      remaining: remaining ? Number(remaining) : undefined,
    };
    return info;
  }
  return null;
}

export function classifyFailure(error: unknown, customClassifier?: (error: unknown) => FailureType): FailureType {
  if (typeof customClassifier === 'function') {
    return customClassifier(error);
  }

  const status = (error as any)?.status ?? (error as any)?.response?.status;
  if (status === 401) return 'auth';
  if (status === 429) return 'rate-limit';
  if ((error as any)?.name === 'AbortError') return 'timeout';

  return 'retryable';
}

