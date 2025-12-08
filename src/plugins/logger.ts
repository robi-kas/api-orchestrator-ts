import { OrchestratorPlugin } from '../types';

export const loggingPlugin = (logger: Console = console): OrchestratorPlugin => ({
  name: 'logging-plugin',
  beforeStart: () => logger.info('[orchestrator] starting'),
  beforeStep: ({ step, attempt }) => logger.info(`[orchestrator] step ${step?.name ?? ''} attempt ${attempt}`),
  afterStep: ({ step }) => logger.info(`[orchestrator] step ${step?.name ?? ''} completed`),
  onRetry: ({ step, attempt, error }) =>
    logger.warn(`[orchestrator] retrying ${step?.name ?? ''} attempt ${attempt}`, error),
  onTimeout: ({ step, timeoutMs }) => logger.error(`[orchestrator] timeout on ${step?.name ?? ''} after ${timeoutMs}ms`),
  onRateLimit: ({ step, rateLimit }) =>
    logger.warn(`[orchestrator] rate-limit on ${step?.name ?? ''}`, rateLimit),
  onError: ({ step, error }) => logger.error(`[orchestrator] error in ${step?.name ?? ''}`, error),
  afterEnd: ({ contextSnapshot }) =>
    logger.info('[orchestrator] finished', { context: contextSnapshot }),
});

