import { 
  StepConfig, 
  OrchestrationContext, 
  OrchestrationConfig, 
  StepResult, 
  OrchestrationResult,
  Logger,
  Plugin
} from '../types';

class DefaultLogger implements Logger {
  info(message: string, meta?: Record<string, any>) {
    console.log(`[INFO] ${message}`, meta || '');
  }
  
  error(message: string, meta?: Record<string, any>) {
    console.error(`[ERROR] ${message}`, meta || '');
  }
  
  warn(message: string, meta?: Record<string, any>) {
    console.warn(`[WARN] ${message}`, meta || '');
  }
  
  debug(message: string, meta?: Record<string, any>) {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}

export async function orchestrate<T extends Record<string, any> = Record<string, any>>(
  steps: StepConfig[],
  config: OrchestrationConfig = {}
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const logger: Logger = config.logger || new DefaultLogger();
  
  const context: OrchestrationContext = {
    results: {},
    sharedData: config.sharedData || {},
    attempt: 0,
    startTime,
    config: {
      ...config,
      logger
    }
  };

  // Initialize plugins
  if (config.plugins) {
    for (const plugin of config.plugins) {
      if (plugin.initialize) {
        plugin.initialize(config);
      }
    }
  }

  logger.info(`Starting orchestration with ${steps.length} steps`, { 
    stepCount: steps.length,
    config: {
      parallel: config.parallel || false,
      stopOnFailure: config.stopOnFailure || false
    }
  });

  const errors: Error[] = [];
  let success = true;

  try {
    if (config.parallel) {
      await executeParallel(steps, context, config, logger);
    } else {
      await executeSequential(steps, context, config, logger);
    }

    // Check if any steps failed
    success = Object.values(context.results).every(result => 
      result.status === 'success' || result.status === 'skipped'
    );
  } catch (error) {
    success = false;
    errors.push(error as Error);
    logger.error('Orchestration failed with error', { error });
  }

  const duration = Date.now() - startTime;

  logger.info(`Orchestration completed`, {
    success,
    duration,
    totalSteps: steps.length,
    successfulSteps: Object.values(context.results).filter(r => r.status === 'success').length,
    failedSteps: Object.values(context.results).filter(r => r.status === 'failed').length
  });

  return {
    success,
    results: context.results,
    duration,
    errors,
    sharedData: context.sharedData
  };
}

async function executeSequential(
  steps: StepConfig[],
  context: OrchestrationContext,
  config: OrchestrationConfig,
  logger: Logger
): Promise<void> {
  for (const step of steps) {
    // Check if step is enabled
    const isEnabled = typeof step.enabled === 'function' 
      ? step.enabled(context)
      : step.enabled !== false;

    if (!isEnabled) {
      logger.debug(`Skipping disabled step: ${step.name}`);
      context.results[step.name] = {
        status: 'skipped',
        duration: 0,
        retryCount: 0
      };
      continue;
    }

    // Check dependencies
    if (step.dependsOn && step.dependsOn.length > 0) {
      const failedDependency = step.dependsOn.find(dep => 
        context.results[dep] && context.results[dep].status !== 'success'
      );
      
      if (failedDependency) {
        logger.debug(`Skipping step ${step.name} due to failed dependency: ${failedDependency}`);
        context.results[step.name] = {
          status: 'skipped',
          duration: 0,
          retryCount: 0,
          error: new Error(`Dependency ${failedDependency} failed`)
        };
        continue;
      }
    }

    try {
      const result = await executeStep(step, context, logger);
      context.results[step.name] = result;

      if (result.status === 'failed' && config.stopOnFailure) {
        logger.warn(`Stopping orchestration due to failed step: ${step.name}`);
        break;
      }
    } catch (error) {
      context.results[step.name] = {
        status: 'failed',
        duration: 0,
        retryCount: 0,
        error: error as Error
      };
      
      if (config.stopOnFailure) {
        throw error;
      }
    }
  }
}

async function executeParallel(
  steps: StepConfig[],
  context: OrchestrationContext,
  config: OrchestrationConfig,
  logger: Logger
): Promise<void> {
  const executions = steps.map(async (step) => {
    try {
      const result = await executeStep(step, context, logger);
      context.results[step.name] = result;
      return result;
    } catch (error) {
      const result: StepResult = {
        status: 'failed',
        duration: 0,
        retryCount: 0,
        error: error as Error
      };
      context.results[step.name] = result;
      return result;
    }
  });

  await Promise.all(executions);
}

async function executeStep(
  step: StepConfig,
  context: OrchestrationContext,
  logger: Logger
): Promise<StepResult> {
  const startTime = Date.now();
  let retryCount = 0;
  let lastError: Error | undefined;

  logger.info(`Executing step: ${step.name}`, { step: step.name });

  // Run plugins before step
  if (context.config.plugins) {
    for (const plugin of context.config.plugins) {
      if (plugin.beforeStep) {
        await plugin.beforeStep(step, context);
      }
    }
  }

  const maxRetries = step.retries !== undefined ? step.retries : context.config.maxRetries || 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await step.execute(context);
      const duration = Date.now() - startTime;

      const result: StepResult = {
        data,
        status: 'success',
        duration,
        retryCount: attempt,
        metadata: step.metadata
      };

      logger.info(`Step ${step.name} succeeded`, {
        step: step.name,
        duration,
        retryCount: attempt
      });

      // Run plugins after successful step
      if (context.config.plugins) {
        for (const plugin of context.config.plugins) {
          if (plugin.afterStep) {
            await plugin.afterStep(step, result, context);
          }
        }
      }

      // Run step's onSuccess callback
      if (step.onSuccess) {
        step.onSuccess(data, context);
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      retryCount = attempt;

      logger.warn(`Step ${step.name} attempt ${attempt + 1}/${maxRetries + 1} failed`, {
        step: step.name,
        attempt: attempt + 1,
        maxAttempts: maxRetries + 1,
        error
      });

      // Run plugins on error
      if (context.config.plugins) {
        for (const plugin of context.config.plugins) {
          if (plugin.onError) {
            await plugin.onError(error as Error, step, context);
          }
        }
      }

      // Run step's onError callback
      if (step.onError) {
        step.onError(error as Error, context);
      }

      // If this was the last attempt, try fallback
      if (attempt === maxRetries) {
        if (step.fallback) {
          logger.info(`Attempting fallback for step: ${step.name}`);
          try {
            const fallbackData = await step.fallback(error as Error, context);
            const duration = Date.now() - startTime;
            
            const result: StepResult = {
              data: fallbackData,
              status: 'success',
              duration,
              retryCount: attempt,
              metadata: { ...step.metadata, usedFallback: true }
            };

            logger.info(`Fallback succeeded for step: ${step.name}`);
            return result;
          } catch (fallbackError) {
            lastError = fallbackError as Error;
            logger.error(`Fallback also failed for step: ${step.name}`, { error: fallbackError });
          }
        }
        
        // No fallback or fallback failed
        const duration = Date.now() - startTime;
        return {
          error: lastError,
          status: 'failed',
          duration,
          retryCount: attempt,
          metadata: step.metadata
        };
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Should never reach here, but just in case
  const duration = Date.now() - startTime;
  return {
    error: lastError || new Error('Step execution failed'),
    status: 'failed',
    duration,
    retryCount,
    metadata: step.metadata
  };
}