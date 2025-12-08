import { OrchestratorContext } from './context';
import { EventBus } from './events';
import { OrchestrateConfig, OrchestrateError, OrchestrateResult, OrchestratorPlugin, RateLimitInfo, RetryPolicy, StepConfig } from '../types';
import { classifyFailure, computeBackoffDelay, createStep, defaultRetryPolicy, detectRateLimit, sleep } from '../utils/step-helpers';
import { SmartThrottle } from '../utils/throttle-queue';

interface InternalConfig {
  retryPolicy: RetryPolicy;
  globalTimeout?: number;
}

export async function orchestrate(steps: StepConfig[], config: OrchestrateConfig = {}): Promise<OrchestrateResult> {
  const context = new OrchestratorContext();
  const events = new EventBus();
  const errors: OrchestrateError[] = [];
  const plugins = config.plugins ?? [];

  const createPluginContext = (
    ctx: OrchestratorContext,
    bus: EventBus,
    step?: string,
    attempt?: number,
    error?: unknown,
    rateLimit?: RateLimitInfo,
    timeoutMs?: number,
  ) => ({
    step: step ? steps.find((s) => s.name === step) : undefined,
    attempt,
    error,
    rateLimit,
    timeoutMs,
    events: bus.getEvents(),
    contextSnapshot: ctx.getSnapshot(),
  });

  const retryPolicy: RetryPolicy = {
    ...defaultRetryPolicy,
    retries: config.retries ?? defaultRetryPolicy.retries,
    baseDelay: config.delay ?? defaultRetryPolicy.baseDelay,
    jitter: config.jitter ?? defaultRetryPolicy.jitter,
    backoffFactor: config.backoffFactor ?? defaultRetryPolicy.backoffFactor,
    maxDelay: config.maxDelay ?? defaultRetryPolicy.maxDelay,
    classifyError: (error) => classifyFailure(error, defaultRetryPolicy.classifyError),
    onRetry: (info) => config.plugins?.forEach((p) => p.onRetry?.(createPluginContext(context, events, info.step, info.attempt, info.error))),
  };

  const internalConfig: InternalConfig = {
    retryPolicy,
    globalTimeout: config.timeout,
  };

  const throttle = new SmartThrottle({
    concurrency: config.throttle?.concurrency ?? 2,
    perSecond: config.throttle?.perSecond,
    adaptive: config.throttle?.adaptive ?? true,
  });

  const invokePlugins = async (
    hook: keyof OrchestratorPlugin,
    data: { step?: string; attempt?: number; error?: unknown; rateLimit?: RateLimitInfo; timeoutMs?: number } = {},
  ) => {
    for (const plugin of plugins) {
      const fn = plugin[hook];
      if (typeof fn === 'function') {
        await fn(createPluginContext(context, events, data.step, data.attempt, data.error, data.rateLimit, data.timeoutMs));
      }
    }
  };

  const executeStep = async (step: StepConfig): Promise<void> => {
    let attempts = 0;
    let lastError: unknown;
    let authRefreshed = false;
    const perStepRetries = step.retries ?? retryPolicy.retries;

    while (attempts <= perStepRetries) {
      attempts += 1;
      const controller = new AbortController();
      const signals = [config.signal];
      signals.forEach((signal) => {
        if (!signal) return;
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', () => controller.abort(), { once: true });
      });

      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutMs = step.timeout ?? internalConfig.globalTimeout;
      const timeoutPromise =
        typeof timeoutMs === 'number'
          ? new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Step timeout'));
              }, timeoutMs);
            })
          : null;

      const stepContext = context.createStepContext(controller.signal, attempts);

      await invokePlugins('beforeStep', { step: step.name, attempt: attempts });
      events.log('beforeStep', { step: step.name, data: { attempt: attempts } });
      const start = Date.now();
      try {
        const executionPromise = step.execute(stepContext);
        const result = timeoutPromise ? await Promise.race([executionPromise, timeoutPromise]) : await executionPromise;
        if (timeoutId) clearTimeout(timeoutId);
        context.addResult(step.name, result);
        const duration = Date.now() - start;
        events.log('afterStep', { step: step.name, data: { duration, attempt: attempts } });
        await invokePlugins('afterStep', { step: step.name, attempt: attempts });
        return;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = error;
        const failureType = classifyFailure(error, retryPolicy.classifyError);

        if (failureType === 'timeout') {
          events.log('onTimeout', { step: step.name, data: { attempt: attempts, timeoutMs } });
          await invokePlugins('onTimeout', { step: step.name, attempt: attempts, timeoutMs });
        }

        if (failureType === 'auth' && config.authRefresh && !authRefreshed) {
          await config.authRefresh(stepContext);
          authRefreshed = true;
          continue;
        }

        const rateLimit = detectRateLimit(error);
        if (rateLimit) {
          events.log('onRateLimit', { step: step.name, data: rateLimit as any });
          await invokePlugins('onRateLimit', { step: step.name, attempt: attempts, rateLimit });
          throttle.onRateLimit();
          throttle.throttleNextCalls();
          const waitFor = rateLimit.retryAfterMs ?? rateLimit.resetInMs ?? 500;
          if (waitFor) {
            await sleep(waitFor);
          }
        }

        const shouldRetry = attempts <= perStepRetries && failureType !== 'auth';
        if (shouldRetry) {
          const delay = computeBackoffDelay(retryPolicy, attempts, step.delay);
          events.log('onRetry', { step: step.name, data: { attempt: attempts, delay } });
          await invokePlugins('onRetry', { step: step.name, attempt: attempts, error });
          if (delay > 0) await sleep(delay);
          continue;
        }

        if (step.fallbackStep) {
          try {
            const fallbackResult = await step.fallbackStep(stepContext);
            context.addResult(step.name, fallbackResult);
            events.log('afterStep', { step: step.name, data: { attempt: attempts, fallback: true } });
            await invokePlugins('afterStep', { step: step.name, attempt: attempts });
            return;
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        } else if (step.fallbackValue !== undefined) {
          context.addResult(step.name, step.fallbackValue);
          events.log('afterStep', { step: step.name, data: { attempt: attempts, fallback: true } });
          await invokePlugins('afterStep', { step: step.name, attempt: attempts });
          return;
        }

        const orchestrateError: OrchestrateError = {
          type: failureType === 'timeout' ? 'timeout' : failureType === 'auth' ? 'auth' : failureType === 'rate-limit' ? 'rate-limit' : 'retry-failed',
          step: step.name,
          message: (error as Error)?.message ?? 'Unknown error',
          attempt: attempts,
          metadata: { error },
        };
        errors.push(orchestrateError);
        events.log('onError', { step: step.name, data: { attempt: attempts, message: orchestrateError.message } });
        await invokePlugins('onError', { step: step.name, attempt: attempts, error });
        return;
      }
    }

    if (lastError) {
      const orchestrateError: OrchestrateError = {
        type: 'retry-failed',
        step: step.name,
        message: (lastError as Error)?.message ?? 'Unknown error',
        attempt: retryPolicy.retries + 1,
        metadata: { error: lastError },
      };
      errors.push(orchestrateError);
      events.log('onError', { step: step.name, data: { attempt: retryPolicy.retries + 1, message: orchestrateError.message } });
      await invokePlugins('onError', { step: step.name, attempt: retryPolicy.retries + 1, error: lastError });
    }
  };

  const run = async (): Promise<void> => {
    await invokePlugins('beforeStart');
    events.log('beforeStart');
    const parallelBuffer: Array<Promise<void>> = [];

    for (const step of steps) {
      if (step.parallel) {
        const task = throttle.add(() => executeStep(step));
        parallelBuffer.push(task);
      } else {
        if (parallelBuffer.length) {
          await Promise.all(parallelBuffer);
          parallelBuffer.length = 0;
        }
        await throttle.add(() => executeStep(step));
      }
    }

    if (parallelBuffer.length) {
      await Promise.all(parallelBuffer);
    }

    await throttle.waitForIdle();
    events.log('afterEnd', { data: { success: errors.length === 0 } });
    await invokePlugins('afterEnd');
  };

  await run();

  return {
    getEvents: () => events.getEvents(),
    results: context.getSnapshot(),
    success: errors.length === 0,
    errors: errors.length ? errors : undefined,
  };
}

export { createStep };

