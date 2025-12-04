import { orchestrate, createStep } from '../src/index';

console.log('🚀 Testing API Orchestrator...');

const testStep = createStep('test', async () => {
  console.log('Step executing...');
  return { message: 'Hello from API Orchestrator!' };
});

async function main() {
  const result = await orchestrate([testStep]);
  console.log('✅ Result:', result);
}

main().catch(console.error);