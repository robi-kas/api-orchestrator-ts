import { StepContext } from '../types';

type MutableRecord = Record<string, unknown>;

export class OrchestratorContext {
  private readonly store: MutableRecord = {};

  addResult(stepName: string, value: unknown): void {
    const parts = stepName.split('.');
    let current: MutableRecord = this.store;

    parts.forEach((part, idx) => {
      const isLeaf = idx === parts.length - 1;
      if (isLeaf) {
        if (Object.prototype.hasOwnProperty.call(current, part)) {
          throw new Error(`Context collision detected for key "${stepName}"`);
        }
        current[part] = Object.freeze(value);
        return;
      }

      if (!current[part]) {
        current[part] = {};
      }

      const next = current[part];
      if (typeof next !== 'object' || next === null || Array.isArray(next)) {
        throw new Error(`Cannot create namespace for "${stepName}" because "${part}" is not an object`);
      }

      current = next as MutableRecord;
    });
  }

  getSnapshot(): Record<string, unknown> {
    return this.deepFreeze({ ...this.store });
  }

  createStepContext(signal: AbortSignal, attempt: number): StepContext {
    return {
      data: this.getSnapshot(),
      get: <T = unknown>(path: string) => this.getByPath<T>(path),
      signal,
      attempt,
    };
  }

  private getByPath<T>(path: string): T | undefined {
    const parts = path.split('.');
    let current: any = this.store;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current as T | undefined;
  }

  private deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        const value = (obj as any)[prop];
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
          this.deepFreeze(value);
        }
      });
    }
    return obj;
  }
}

