import { StepConfig } from '../types';

export function createStep<T = any, R = any>(
  name: string,
  execute: (context: any) => Promise<R>,
  config?: Partial<StepConfig<T, R>>
): StepConfig<T, R> {
  return {
    name,
    execute,
    ...config
  };
}