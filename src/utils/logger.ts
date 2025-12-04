import { Logger } from '../types';

export function createLogger(customLogger?: Partial<Logger>): Logger {
  const defaultLogger: Logger = {
    info: (message: string, meta?: Record<string, any>) => {
      console.log(`[INFO] ${message}`, meta || '');
    },
    error: (message: string, meta?: Record<string, any>) => {
      console.error(`[ERROR] ${message}`, meta || '');
    },
    warn: (message: string, meta?: Record<string, any>) => {
      console.warn(`[WARN] ${message}`, meta || '');
    },
    debug: (message: string, meta?: Record<string, any>) => {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  };

  return {
    ...defaultLogger,
    ...customLogger
  };
}