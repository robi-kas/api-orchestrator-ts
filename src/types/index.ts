export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface StepResult<T = any> {
  data?: T;
  error?: Error;
  status: StepStatus;
  duration: number;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface StepConfig<T = any, R = any> {
  name: string;
  execute: (context: OrchestrationContext) => Promise<R>;
  retries?: number;
  timeout?: number;
  fallback?: (error: Error, context: OrchestrationContext) => Promise<R>;
  dependsOn?: string[];
  enabled?: boolean | ((context: OrchestrationContext) => boolean);
  onSuccess?: (result: R, context: OrchestrationContext) => void;
  onError?: (error: Error, context: OrchestrationContext) => void;
  metadata?: Record<string, any>;
}

export interface OrchestrationContext {
  results: Record<string, StepResult>;
  sharedData: Record<string, any>;
  attempt: number;
  startTime: number;
  config: OrchestrationConfig;
}

export interface OrchestrationConfig {
  maxRetries?: number;
  timeout?: number;
  parallel?: boolean;
  stopOnFailure?: boolean;
  sharedData?: Record<string, any>;
  logger?: Logger;
  plugins?: Plugin[];
}

export interface Logger {
  info: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
}

export interface Plugin {
  name: string;
  initialize?: (config: OrchestrationConfig) => void;
  beforeStep?: (step: StepConfig, context: OrchestrationContext) => Promise<void> | void;
  afterStep?: (step: StepConfig, result: StepResult, context: OrchestrationContext) => Promise<void> | void;
  onError?: (error: Error, step: StepConfig, context: OrchestrationContext) => Promise<void> | void;
}

export interface OrchestrationResult {
  success: boolean;
  results: Record<string, StepResult>;
  duration: number;
  errors: Error[];
  sharedData: Record<string, any>;
}