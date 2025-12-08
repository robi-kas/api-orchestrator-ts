import { orchestrate, createStep } from '../src';

async function main() {
  const steps = [
    createStep(
      'primaryApi',
      async () => {
        throw Object.assign(new Error('Primary offline'), { status: 503 });
      },
      {
        retries: 1,
        fallbackStep: async () => ({ source: 'cache', value: 42 }),
      },
    ),
  ];

  const result = await orchestrate(steps);
  console.log(result.results);
}

void main();

