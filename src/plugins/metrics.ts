import { OrchestratorPlugin } from '../types';

export interface MetricsStore {
  stepsStarted: number;
  stepsSucceeded: number;
  stepsFailed: number;
  retries: number;
  timeouts: number;
  rateLimits: number;
}

export const createMetricsPlugin = (store: MetricsStore = {
  stepsStarted: 0,
  stepsSucceeded: 0,
  stepsFailed: 0,
  retries: 0,
  timeouts: 0,
  rateLimits: 0,
}): OrchestratorPlugin => ({
  name: 'metrics-plugin',
  beforeStep: () => {
    store.stepsStarted += 1;
  },
  afterStep: () => {
    store.stepsSucceeded += 1;
  },
  onRetry: () => {
    store.retries += 1;
  },
  onTimeout: () => {
    store.timeouts += 1;
  },
  onRateLimit: () => {
    store.rateLimits += 1;
  },
  onError: () => {
    store.stepsFailed += 1;
  },
});

export type MetricsPlugin = ReturnType<typeof createMetricsPlugin>;

