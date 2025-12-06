import { CircuitBreaker } from '../utils/circuit-breaker';
import { FallbackExecutor } from '../utils/fallback-executor';
import { 
  StepConfig, 
  OrchestrationConfig, 
  OrchestrationResult,
  CircuitBreakerConfig,
  FallbackConfig 
} from '../types';

export async function orchestrate(
  steps: StepConfig[], 
  config: OrchestrationConfig = {}
): Promise<OrchestrationResult> {
  // Dynamic import of p-retry to handle ESM
  const pRetryModule = await import('p-retry');
  const pRetry = pRetryModule.default;
  const AbortError = pRetryModule.AbortError;

  // Initialize utilities
  const circuitBreaker = new CircuitBreaker();
  const fallbackExecutor = new FallbackExecutor();
  
  console.log('🎯 Orchestrator starting...');
  
  const startTime = Date.now();
  const results: Record<string, any> = {};
  const errors: Error[] = [];
  const circuitBreakers: Record<string, any> = {};
  
  const context = { 
    results, 
    sharedData: config.sharedData || {},
    attempt: 0,
    startTime,
    config,
    errors,
    circuitBreakers,
    cache: config.sharedData?.cache || {}
  };
  
  const logger = config.logger || {
    info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
    error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
    debug: (msg: string, meta?: any) => console.debug(`[DEBUG] ${msg}`, meta || '')
  };
  
  
  logger.info(`Starting orchestration with ${steps.length} steps`, {
    stepCount: steps.length,
    config: {
      parallel: config.parallel || false,
      stopOnFailure: config.stopOnFailure || false,
      maxRetries: config.maxRetries || 0,
      enableCaching: config.enableCaching || false
    }
  });
  
  for (const step of steps) {
    logger.info(`Executing step: ${step.name}`, { step: step.name });
    const stepStart = Date.now();
    let retryCount = 0;
    let lastError: any = null;
    let circuitBroken = false;
    
    try {
      // Determine retry configuration for this step
      const stepRetries = step.retries !== undefined ? step.retries : config.maxRetries || 0;
      const stepTimeout = step.timeout || config.timeout;
      
      // Execute with circuit breaker and retry logic
      const data = await executeStepWithFeatures(step, context, {
        retries: stepRetries,
        timeout: stepTimeout,
        logger,
        stepName: step.name,
        pRetry,
        AbortError,
        circuitBreaker,
        circuitConfig: step.circuitBreaker || config.defaultCircuitBreaker
      });
      
      const duration = Date.now() - stepStart;
      
      results[step.name] = {
        data,
        status: 'success',
        duration,
        retryCount,
        metadata: step.metadata,
        circuitBroken
      };
      
      logger.info(`Step ${step.name} succeeded`, {
        step: step.name,
        duration,
        retryCount,
        circuitBroken
      });
      
      // Call step's onSuccess callback if provided
      if (step.onSuccess) {
        step.onSuccess(data, context);
      }
      
    } catch (error: any) {
      const duration = Date.now() - stepStart;
      lastError = error;
      
      // Check if error is from circuit breaker
      if (error.message.includes('Circuit breaker')) {
        circuitBroken = true;
        logger.warn(`Circuit breaker triggered for ${step.name}`, {
          step: step.name,
          error: error.message
        });
      } else {
        logger.error(`Step ${step.name} failed after ${retryCount} retries`, {
          step: step.name,
          error: error.message,
          retryCount,
          duration,
          circuitBroken
        });
      }
      
      // Try fallback if provided
      const fallbacks = Array.isArray(step.fallbacks) 
        ? step.fallbacks 
        : step.fallback 
        ? [step.fallback] 
        : [];
      
      if (fallbacks.length > 0) {
        logger.info(`Attempting fallback for step: ${step.name}`, {
          fallbackCount: fallbacks.length
        });
        
        let fallbackError = error;
        let fallbackResult: any = null;
        let usedFallbackStrategy: string | undefined;
        
        // Try multiple fallbacks in order
        for (const fallback of fallbacks) {
          try {
            fallbackResult = await fallbackExecutor.execute(fallbackError, context, fallback);
            usedFallbackStrategy = typeof fallback === 'function' 
              ? 'function' 
              : (fallback as FallbackConfig).strategy;
            
            logger.info(`Fallback succeeded for step: ${step.name}`, {
              strategy: usedFallbackStrategy
            });
            
            results[step.name] = {
              data: fallbackResult,
              status: 'success',
              duration,
              retryCount,
              metadata: { ...step.metadata, usedFallback: true, fallbackStrategy: usedFallbackStrategy },
              fallbackUsed: true,
              circuitBroken
            };
            break; // Stop after first successful fallback
          } catch (fallbackError: any) {
            logger.warn(`Fallback failed for step: ${step.name}`, {
              strategy: typeof fallback === 'function' ? 'function' : (fallback as FallbackConfig).strategy,
              error: fallbackError.message
            });
            lastError = fallbackError;
          }
        }
        
        if (fallbackResult) {
          continue; // Move to next step
        }
      }
      
      // Record failure
      results[step.name] = {
        error: lastError.message,
        status: 'failed',
        duration,
        retryCount,
        metadata: step.metadata,
        circuitBroken
      };
      errors.push(lastError);
      
      // Call step's onError callback if provided
      if (step.onError) {
        step.onError(lastError, context);
      }
      
      // Stop if configured to stop on failure
      if (config.stopOnFailure) {
        logger.warn(`Stopping orchestration due to failed step: ${step.name}`);
        break;
      }
    }
  }
  
  const totalDuration = Date.now() - startTime;
  const success = errors.length === 0;
  
  // Collect circuit breaker states
  const circuitBreakerStates: Record<string, any> = {};
  for (const step of steps) {
    const state = circuitBreaker.getStateForStep(step.name);
    if (state) {
      circuitBreakerStates[step.name] = state;
    }
  }
  
  logger.info(`Orchestration completed`, {
    success,
    duration: totalDuration,
    totalSteps: steps.length,
    successfulSteps: Object.values(results).filter((r: any) => r.status === 'success').length,
    failedSteps: Object.values(results).filter((r: any) => r.status === 'failed').length,
    totalErrors: errors.length,
    circuitBreakers: Object.keys(circuitBreakerStates).length
  });
  
  return {
    success,
    results,
    duration: totalDuration,
    errors,
    sharedData: context.sharedData,
    circuitBreakers: circuitBreakerStates
  };
}

async function executeStepWithFeatures(
  step: any,
  context: any,
  options: {
    retries: number;
    timeout?: number;
    logger: any;
    stepName: string;
    pRetry: any;
    AbortError: any;
    circuitBreaker: CircuitBreaker;
    circuitConfig?: CircuitBreakerConfig;
  }
) {
  const { retries, timeout, logger, stepName, pRetry, AbortError, circuitBreaker, circuitConfig } = options;
  
  // Check circuit breaker
  if (circuitConfig?.enabled) {
    try {
      return await circuitBreaker.execute(
        stepName,
        circuitConfig,
        () => executeWithRetry(step, context, { retries, timeout, logger, stepName, pRetry, AbortError })
      );
    } catch (error: any) {
      throw error;
    }
  }
  
  return executeWithRetry(step, context, { retries, timeout, logger, stepName, pRetry, AbortError });
}

async function executeWithRetry(
  step: any, 
  context: any, 
  options: {
    retries: number;
    timeout?: number;
    logger: any;
    stepName: string;
    pRetry: any;
    AbortError: any;
  }
) {
  const { retries, timeout, logger, stepName, pRetry, AbortError } = options;
  
  // If no retries needed, execute directly
  if (retries === 0) {
    if (timeout) {
      return await executeWithTimeout(step, context, timeout);
    }
    return await step.execute(context);
  }
  
  // Configure retry options
  const retryOptions = {
    retries,
    factor: 2, // Exponential backoff factor
    minTimeout: 1000, // 1 second minimum wait
    maxTimeout: 10000, // 10 seconds maximum wait
    randomize: true, // Add some randomness to avoid thundering herd
    onFailedAttempt: (error: any) => {
      const attempt = error.attemptNumber;
      const retriesLeft = error.retriesLeft;
      
      logger.warn(`Attempt ${attempt} failed for ${stepName}. ${retriesLeft} retries left`, {
        step: stepName,
        attempt,
        retriesLeft,
        nextRetryIn: error.nextRetry,
        error: error.message
      });
      
      // Check if we should abort retries for certain errors
      if (shouldAbortRetry(error)) {
        logger.error(`Aborting retries for ${stepName} due to non-retryable error`, {
          step: stepName,
          error: error.message
        });
        throw new AbortError(error);
      }
    }
  };
  
  // Wrap execution with timeout if specified
  const executeFn = timeout 
    ? () => executeWithTimeout(step, context, timeout)
    : () => step.execute(context);
  
  return await pRetry(executeFn, retryOptions);
}

async function executeWithTimeout(step: any, context: any, timeoutMs: number) {
  return Promise.race([
    step.execute(context),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step "${step.name}" timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function shouldAbortRetry(error: any): boolean {
  // Don't retry on certain error types
  const abortErrors = [
    'ECONNREFUSED', // Connection refused
    'ENOTFOUND', // DNS lookup failed
    'UNAUTHORIZED', // 401 Unauthorized
    'FORBIDDEN', // 403 Forbidden
    'NOT_FOUND', // 404 Not Found
    'VALIDATION_ERROR' // Validation errors
  ];
  
  const errorCode = error.code || error.name || '';
  const errorMessage = error.message || '';
  
  // Check if error message contains abort patterns
  for (const abortError of abortErrors) {
    if (errorCode.includes(abortError) || errorMessage.includes(abortError)) {
      return true;
    }
  }
  
  // Don't retry 4xx client errors (except 429 Too Many Requests)
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
    return true;
  }
  
  return false;
}