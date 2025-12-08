import { orchestrate, createStep, loggingPlugin } from '../src';

async function main() {
  const steps = [
    createStep('getConfig', async () => ({ region: 'us-east-1' })),
    createStep('callApi', async ({ get }) => {
      const cfg = get<{ region: string }>('getConfig');
      return { ok: true, region: cfg?.region };
    }),
  ];

  const result = await orchestrate(steps, {
    plugins: [loggingPlugin()],
  });

  console.log('results', result.results);
}

void main();

