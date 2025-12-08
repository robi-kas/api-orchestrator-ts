export type FailureType = 'timeout' | 'retryable' | 'auth' | 'rate-limit' | 'unknown';

export interface RetryPolicy {
  retries: number;
  backoffFactor: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  classifyError?: (error: unknown) => FailureType;
  onRetry?: (info: RetryInfo) => void | Promise<void>;
}

export interface RetryInfo {
  step: string;
  attempt: number;
  error: unknown;
  delay: number;
}

export interface TimeoutOptions {
  timeoutMs?: number;
}

export interface StepConfig {
  name: string;
  execute: (context: StepContext) => Promise<any>;
  timeout?: number;
  retries?: number;
  delay?: number;
  fallbackValue?: any;
  fallbackStep?: (context: StepContext) => Promise<any>;
  parallel?: boolean;
}

export interface StepContext {
  data: Record<string, unknown>;
  get: <T = unknown>(path: string) => T | undefined;
  signal: AbortSignal;
  attempt: number;
}

export interface OrchestrateConfig {
  timeout?: number;
  retries?: number;
  delay?: number;
  jitter?: boolean;
  backoffFactor?: number;
  maxDelay?: number;
  throttle?: ThrottleConfig;
  plugins?: OrchestratorPlugin[];
  authRefresh?: (context: StepContext) => Promise<void>;
  signal?: AbortSignal;
}

export interface ThrottleConfig {
  concurrency?: number;
  perSecond?: number;
  adaptive?: boolean;
}

export interface OrchestrateError {
  type: 'timeout' | 'retry-failed' | 'auth' | 'rate-limit' | 'unknown';
  step: string;
  message: string;
  attempt: number;
  metadata?: any;
}

export interface OrchestrateResult {
  success: boolean;
  results: Record<string, unknown>;
  errors?: OrchestrateError[];
  getEvents: () => TelemetryEvent[];
}

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  step?: string;
  data?: Record<string, unknown>;
}

export interface PluginContext {
  step?: StepConfig;
  attempt?: number;
  error?: unknown;
  rateLimit?: RateLimitInfo;
  timeoutMs?: number;
  retryInfo?: RetryInfo;
  events: TelemetryEvent[];
  contextSnapshot: Record<string, unknown>;
}

export interface RateLimitInfo {
  resetInMs?: number;
  retryAfterMs?: number;
  remaining?: number;
}

export interface OrchestratorPlugin {
  name: string;
  beforeStart?: (ctx: PluginContext) => void | Promise<void>;
  beforeStep?: (ctx: PluginContext) => void | Promise<void>;
  afterStep?: (ctx: PluginContext) => void | Promise<void>;
  onRetry?: (ctx: PluginContext) => void | Promise<void>;
  onTimeout?: (ctx: PluginContext) => void | Promise<void>;
  onRateLimit?: (ctx: PluginContext) => void | Promise<void>;
  onError?: (ctx: PluginContext) => void | Promise<void>;
  afterEnd?: (ctx: PluginContext) => void | Promise<void>;
}

