export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface StepResult<T = any> {
  data?: T;
  error?: Error;
  status: StepStatus;
  duration: number;
  retryCount: number;
  metadata?: Record<string, any>;
  fallbackUsed?: boolean;
  circuitBroken?: boolean;
}

export type FallbackStrategy = 
  | 'static-value' 
  | 'cached-data' 
  | 'alternative-api' 
  | 'degraded-mode' 
  | 'custom';

export interface FallbackConfig<T = any> {
  strategy: FallbackStrategy;
  value?: T;
  cacheKey?: string;
  alternativeStep?: string;
  degradedHandler?: (context: any) => Promise<T>;
  customHandler?: (error: Error, context: any) => Promise<T>;
  conditions?: {
    errorCodes?: string[];
    maxRetriesExceeded?: boolean;
    timeoutExceeded?: boolean;
  };
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts?: number;
}

export interface StepConfig<T = any, R = any> {
  name: string;
  execute: (context: any) => Promise<R>;
  retries?: number;
  timeout?: number;
  fallback?: FallbackConfig<R> | ((error: Error, context: any) => Promise<R>);
  fallbacks?: FallbackConfig<R>[];
  circuitBreaker?: CircuitBreakerConfig;
  dependsOn?: string[];
  enabled?: boolean | ((context: any) => boolean);
  onSuccess?: (result: R, context: any) => void;
  onError?: (error: Error, context: any) => void;
  metadata?: Record<string, any>;
}

export interface OrchestrationContext {
  results: Record<string, StepResult>;
  sharedData: Record<string, any>;
  attempt: number;
  startTime: number;
  config: OrchestrationConfig;
  circuitBreakers?: Record<string, any>;
  cache?: Record<string, any>;
}

export interface OrchestrationConfig {
  maxRetries?: number;
  timeout?: number;
  parallel?: boolean;
  stopOnFailure?: boolean;
  sharedData?: Record<string, any>;
  logger?: Logger;
  plugins?: any[];
  enableCaching?: boolean;
  defaultCircuitBreaker?: CircuitBreakerConfig;
}

export interface Logger {
  info: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
}

export interface OrchestrationResult {
  success: boolean;
  results: Record<string, StepResult>;
  duration: number;
  errors: Error[];
  sharedData: Record<string, any>;
  circuitBreakers?: Record<string, any>;
}