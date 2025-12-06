export interface FallbackConfig<T = any> {
  strategy: 'static-value' | 'cached-data' | 'alternative-api' | 'degraded-mode' | 'custom';
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

export class FallbackExecutor {
  async execute<T>(
    error: Error,
    context: any,
    fallback: FallbackConfig<T> | ((error: Error, context: any) => Promise<T>)
  ): Promise<T> {
    // Handle function fallback (backward compatibility)
    if (typeof fallback === 'function') {
      return fallback(error, context);
    }

    // Handle configured fallback
    const config = fallback as FallbackConfig<T>;
    
    // Check conditions
    if (!this.checkConditions(error, context, config.conditions)) {
      throw error;
    }

    switch (config.strategy) {
      case 'static-value':
        if (config.value === undefined) {
          throw new Error('Static value fallback requires a value');
        }
        return config.value;

      case 'cached-data':
        if (!config.cacheKey) {
          throw new Error('Cache fallback requires a cacheKey');
        }
        const cached = context.cache?.[config.cacheKey];
        if (cached === undefined) {
          throw new Error(`No cached data found for key: ${config.cacheKey}`);
        }
        return cached;

      case 'alternative-api':
        if (!config.alternativeStep) {
          throw new Error('Alternative API fallback requires an alternativeStep');
        }
        const altResult = context.results[config.alternativeStep];
        if (!altResult || altResult.status !== 'success') {
          throw new Error(`Alternative step "${config.alternativeStep}" not available or failed`);
        }
        return altResult.data;

      case 'degraded-mode':
        if (!config.degradedHandler) {
          throw new Error('Degraded mode fallback requires a handler');
        }
        return config.degradedHandler(context);

      case 'custom':
        if (!config.customHandler) {
          throw new Error('Custom fallback requires a handler');
        }
        return config.customHandler(error, context);

      default:
        throw new Error(`Unknown fallback strategy: ${config.strategy}`);
    }
  }

  private checkConditions(
    error: Error,
    context: any,
    conditions?: {
      errorCodes?: string[];
      maxRetriesExceeded?: boolean;
      timeoutExceeded?: boolean;
    }
  ): boolean {
    if (!conditions) {
      return true;
    }

    // Check error codes
    if (conditions.errorCodes && conditions.errorCodes.length > 0) {
      const errorCode = (error as any).code || '';
      const errorMessage = error.message || '';
      const matches = conditions.errorCodes.some(code => 
        errorCode.includes(code) || errorMessage.includes(code)
      );
      if (!matches) {
        return false;
      }
    }

    // Check timeout
    if (conditions.timeoutExceeded) {
      const isTimeout = error.message.includes('timeout') || 
                       error.message.includes('timed out') ||
                       (error as any).name === 'TimeoutError';
      if (!isTimeout) {
        return false;
      }
    }

    return true;
  }
}