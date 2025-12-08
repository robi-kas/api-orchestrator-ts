import { orchestrate, createStep } from '../src';

async function main() {
  const steps = [
    createStep(
      'slowCall',
      async () => {
        await new Promise((_, reject) => setTimeout(() => reject(new Error('Too slow')), 1500));
        return 'never';
      },
      { timeout: 500, fallbackValue: 'fallback-response' },
    ),
  ];

  const result = await orchestrate(steps, { timeout: 1000 });
  console.log(result.results);
  console.log('events', result.getEvents());
}

void main();

