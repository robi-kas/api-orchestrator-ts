import { ThrottleConfig } from '../types';

interface SmartThrottleOptions extends ThrottleConfig {
  minimumConcurrency?: number;
  maximumConcurrency?: number;
}

type PQueueCtor = typeof import('p-queue')['default'];
type PQueueInstance = import('p-queue').default;

// Use native dynamic import at runtime (avoids CommonJS require of ESM p-queue)
const dynamicImport: (specifier: string) => Promise<any> = (specifier) =>
  (new Function('s', 'return import(s);'))(specifier);

export class SmartThrottle {
  private readonly queuePromise: Promise<PQueueInstance>;
  private readonly options: SmartThrottleOptions;
  private softPaused = false;

  constructor(options: SmartThrottleOptions = {}) {
    this.options = {
      concurrency: options.concurrency ?? 2,
      perSecond: options.perSecond,
      adaptive: options.adaptive ?? true,
      minimumConcurrency: options.minimumConcurrency ?? 1,
      maximumConcurrency: options.maximumConcurrency ?? Math.max(options.concurrency ?? 2, 4),
    };

    this.queuePromise = dynamicImport('p-queue').then((mod: { default: PQueueCtor }) => {
      const PQueueDefault = mod.default;
      const perSecond = options.perSecond;
      const intervalSettings = perSecond && perSecond > 0 ? { intervalCap: perSecond, interval: 1000 } : {};
      return new PQueueDefault({
        concurrency: this.options.concurrency,
        autoStart: true,
        ...intervalSettings,
      });
    }) as Promise<PQueueInstance>;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    await this.maybeAdapt();
    const queue = await this.queuePromise;
    return queue.add(() => fn()) as Promise<T>;
  }

  softPause(): void {
    if (this.softPaused) return;
    this.softPaused = true;
    void this.queuePromise.then((queue) => queue.pause());
  }

  hardPause(): void {
    void this.queuePromise.then((queue) => queue.pause());
  }

  resume(): void {
    this.softPaused = false;
    void this.queuePromise.then((queue) => queue.start());
  }

  async waitForIdle(): Promise<void> {
    const queue = await this.queuePromise;
    await queue.onIdle();
  }

  onRateLimit(): void {
    // reduce concurrency temporarily to avoid further rate limits
    const min = this.options.minimumConcurrency ?? 1;
    void this.queuePromise.then((queue) => {
      const next = Math.max(min, Math.floor((queue.concurrency ?? 1) / 2) || 1);
      queue.concurrency = next;
    });
  }

  throttleNextCalls(): void {
    this.softPause();
    setTimeout(() => this.resume(), 250);
  }

  private async maybeAdapt(): Promise<void> {
    if (!this.options.adaptive) return;
    const queue = await this.queuePromise;
    const pending = queue.size;
    const running = queue.pending;

    if (pending > (queue.concurrency ?? 1) * 2) {
      const min = this.options.minimumConcurrency ?? 1;
      queue.concurrency = Math.max(min, (queue.concurrency ?? 1) - 1);
      return;
    }

    if (running < (queue.concurrency ?? 1) / 2 && (queue.concurrency ?? 1) < (this.options.maximumConcurrency ?? 4)) {
      queue.concurrency = (queue.concurrency ?? 1) + 1;
    }
  }
}

