import { orchestrate, createStep } from '../src';

// Example steps
const authStep = createStep('auth', async (context: any) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  return { token: 'abc123', userId: 1 };
});

const fetchUserStep = createStep('fetchUser', async (context: any) => {
  // Access result from previous step
  const authResult = context.results.auth.data;
  console.log(`Using token: ${authResult.token}`);
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 150));
  return { id: 1, name: 'John Doe', email: 'john@example.com' };
});

const sendEmailStep = createStep('sendEmail', async (context: any) => {
  const user = context.results.fetchUser.data;
  
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(`Email sent to ${user.email}`);
  
  return { success: true, messageId: 'msg_123' };
}, {
  retries: 2,
  fallback: async (error: Error, context: any) => {
    console.log('Email service failed, logging to database instead');
    return { success: false, fallbackUsed: true };
  }
});

async function runExample() {
  console.log('Starting basic orchestration example...\n');
  
  const result = await orchestrate(
    [authStep, fetchUserStep, sendEmailStep],
    {
      maxRetries: 1,
      stopOnFailure: false,
      logger: {
        info: (msg: string) => console.log(`📝 ${msg}`),
        error: (msg: string) => console.error(`❌ ${msg}`),
        warn: (msg: string) => console.warn(`⚠️ ${msg}`),
        debug: (msg: string) => console.debug(`🔍 ${msg}`)
      }
    }
  );
  
  console.log('\n--- Orchestration Result ---');
  console.log(`Success: ${result.success}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Steps executed: ${Object.keys(result.results).length}`);
  
  Object.entries(result.results).forEach(([name, stepResult]: [string, any]) => {
    console.log(`\nStep: ${name}`);
    console.log(`  Status: ${stepResult.status}`);
    console.log(`  Duration: ${stepResult.duration}ms`);
    console.log(`  Retries: ${stepResult.retryCount}`);
    if (stepResult.error) {
      console.log(`  Error: ${stepResult.error.message}`);
    }
  });
}

runExample().catch(console.error);