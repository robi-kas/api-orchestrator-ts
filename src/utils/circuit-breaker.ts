export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts?: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttempt: number;
  halfOpenAttempts: number;
}

export class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();

  execute<T>(
    key: string,
    config: CircuitBreakerConfig,
    fn: () => Promise<T>
  ): Promise<T> {
    const state = this.getState(key, config);
    const now = Date.now();

    // Check circuit state
    if (state.state === 'open') {
      if (now >= state.nextAttempt) {
        state.state = 'half-open';
        state.halfOpenAttempts = 0;
      } else {
        throw new Error(`Circuit breaker "${key}" is OPEN. Next attempt at ${new Date(state.nextAttempt).toISOString()}`);
      }
    }

    if (state.state === 'half-open' && state.halfOpenAttempts >= (config.halfOpenMaxAttempts || 1)) {
      state.state = 'open';
      state.nextAttempt = now + config.resetTimeout;
      throw new Error(`Circuit breaker "${key}" re-opened after half-open attempts`);
    }

    // Execute the function
    return fn()
      .then(result => {
        // Success - reset circuit
        if (state.state === 'half-open') {
          state.state = 'closed';
          state.failures = 0;
          state.halfOpenAttempts = 0;
        } else {
          state.failures = Math.max(0, state.failures - 1);
        }
        return result;
      })
      .catch(error => {
        // Failure - update circuit state
        state.failures++;
        state.lastFailure = now;

        if (state.state === 'half-open') {
          state.halfOpenAttempts++;
          if (state.halfOpenAttempts >= (config.halfOpenMaxAttempts || 1)) {
            state.state = 'open';
            state.nextAttempt = now + config.resetTimeout;
          }
        } else if (state.failures >= config.failureThreshold) {
          state.state = 'open';
          state.nextAttempt = now + config.resetTimeout;
        }

        throw error;
      });
  }

  getState(key: string, config: CircuitBreakerConfig): CircuitBreakerState {
    if (!this.states.has(key)) {
      this.states.set(key, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        nextAttempt: 0,
        halfOpenAttempts: 0
      });
    }
    return this.states.get(key)!;
  }

  getStateForStep(stepName: string): CircuitBreakerState | undefined {
    return this.states.get(stepName);
  }

  reset(key: string): void {
    this.states.delete(key);
  }

  resetAll(): void {
    this.states.clear();
  }
}