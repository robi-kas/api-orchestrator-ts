import { orchestrate, createStep } from '../src';

async function main() {
  const steps = [
    createStep('warmup', async () => 'ready'),
    createStep(
      'batchA',
      async () => {
        await new Promise((r) => setTimeout(r, 200));
        return [1, 2, 3];
      },
      { parallel: true },
    ),
    createStep(
      'batchB',
      async () => {
        await new Promise((r) => setTimeout(r, 150));
        return ['a', 'b'];
      },
      { parallel: true },
    ),
    createStep('combine', async ({ get }) => {
      const a = get<number[]>('batchA') ?? [];
      const b = get<string[]>('batchB') ?? [];
      return { size: a.length + b.length };
    }),
  ];

  const result = await orchestrate(steps, { throttle: { concurrency: 2 } });
  console.log(result.results);
}

void main();

