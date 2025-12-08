import { OrchestratorPlugin } from '../types';

export interface StripePluginOptions {
  onAuthRefresh?: () => Promise<void> | void;
  onRateLimitWait?: (ms: number) => Promise<void> | void;
}

export const stripePlugin = (options: StripePluginOptions = {}): OrchestratorPlugin => ({
  name: 'stripe-plugin',
  onRateLimit: async ({ rateLimit }) => {
    const wait = rateLimit?.retryAfterMs ?? rateLimit?.resetInMs;
    if (wait && options.onRateLimitWait) {
      await options.onRateLimitWait(wait);
    }
  },
  onError: async ({ error }) => {
    const status = (error as any)?.status ?? (error as any)?.response?.status;
    if (status === 401 && options.onAuthRefresh) {
      await options.onAuthRefresh();
    }
  },
});

