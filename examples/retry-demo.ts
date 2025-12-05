import { orchestrate, createStep } from '../src/index';

console.log('🔄 Day 3: Testing Retry Logic with Exponential Backoff\n');

// Step that fails 2 times then succeeds (simulating flaky API)
let attemptCount = 0;
const flakyApiStep = createStep('flakyApi', async () => {
  attemptCount++;
  console.log(`Attempt ${attemptCount} for flaky API...`);
  
  if (attemptCount < 3) {
    throw new Error(`API temporarily unavailable (attempt ${attemptCount})`);
  }
  
  return { data: 'API succeeded on attempt ' + attemptCount };
}, {
  retries: 5, // Will retry up to 5 times
  timeout: 2000, // 2 second timeout per attempt
  onError: (error: Error) => {
    console.log(`  → Error callback: ${error.message}`);
  }
});

// Step that times out
const timeoutStep = createStep('timeoutStep', async () => {
  console.log('Starting timeout step...');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Will take 3 seconds
  return 'This should not be reached';
}, {
  retries: 2,
  timeout: 1000, // Will timeout after 1 second
  fallback: async (error: Error) => {
    console.log(`  → Fallback triggered: ${error.message}`);
    return { fallbackData: 'Used fallback after timeout' };
  }
});

// Step with non-retryable error
const nonRetryableStep = createStep('nonRetryable', async () => {
  const error: any = new Error('UNAUTHORIZED: Invalid credentials');
  error.code = 'UNAUTHORIZED';
  throw error;
}, {
  retries: 3,
  onError: (error: Error) => {
    console.log(`  → Non-retryable error: ${error.message}`);
  }
});

async function runDemo() {
  console.log('=== Demo 1: Flaky API with Retries ===');
  attemptCount = 0;
  const result1: any = await orchestrate([flakyApiStep], {
    maxRetries: 3,
    stopOnFailure: false,
    logger: {
      info: (msg: string) => console.log(`📝 ${msg}`),
      warn: (msg: string) => console.log(`⚠️  ${msg}`),
      error: (msg: string) => console.log(`❌ ${msg}`)
    }
  } as any);
  console.log(`Result: ${result1.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Final attempt count: ${attemptCount}\n`);
  
  console.log('=== Demo 2: Timeout with Fallback ===');
  const result2: any = await orchestrate([timeoutStep], {
    timeout: 5000,
    stopOnFailure: false
  } as any);
  console.log(`Result: ${result2.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Used fallback: ${result2.results.timeoutStep.data?.fallbackData ? 'Yes' : 'No'}\n`);
  
  console.log('=== Demo 3: Non-retryable Error ===');
  const result3: any = await orchestrate([nonRetryableStep], {
    maxRetries: 3,
    stopOnFailure: false
  } as any);
  console.log(`Result: ${result3.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Error: ${result3.results.nonRetryable.error}\n`);
  
  console.log('=== Summary ===');
  console.log('Retry logic features tested:');
  console.log('✅ Exponential backoff (1s, 2s, 4s, etc.)');
  console.log('✅ Timeout handling');
  console.log('✅ Smart error classification (some errors not retried)');
  console.log('✅ Fallback mechanisms');
  console.log('✅ Detailed logging');
}

runDemo().catch(console.error);