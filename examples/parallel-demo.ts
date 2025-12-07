import { orchestrate, createStep } from '../src';

console.log('⚡ Day 5: Parallel Execution Demo\n');

async function demo() {
  console.log('=== Test 1: Sequential vs Parallel Comparison ===\n');
  
  // Create steps that simulate API calls with delays
  const createApiStep = (name: string, delay: number) => 
    createStep(name, async () => {
      console.log(`  ${name}: Starting (${delay}ms delay)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`  ${name}: Completed`);
      return { data: `${name}_data`, duration: delay };
    });
  
  const step1 = createApiStep('fetchUser', 300);
  const step2 = createApiStep('fetchProducts', 200);
  const step3 = createApiStep('fetchOrders', 250);
  const step4 = createApiStep('analytics', 150);
  
  console.log('Sequential execution (default):');
  const startSequential = Date.now();
  const result1 = await orchestrate([step1, step2, step3, step4]);
  const sequentialDuration = Date.now() - startSequential;
  console.log(`  ⏱️  Total time: ${sequentialDuration}ms`);
  console.log(`  Expected: ~300+200+250+150 = ~900ms\n`);
  
  console.log('Parallel execution:');
  const startParallel = Date.now();
  const result2 = await orchestrate([step1, step2, step3, step4], {
    parallel: true,
    logger: {
      info: (msg: string) => console.log(`  📝 ${msg}`),
      error: (msg: string) => console.log(`  ❌ ${msg}`)
    }
  });
  const parallelDuration = Date.now() - startParallel;
  console.log(`  ⏱️  Total time: ${parallelDuration}ms`);
  console.log(`  Expected: ~max(300,200,250,150) = ~300ms`);
  console.log(`  Speedup: ${((sequentialDuration - parallelDuration) / sequentialDuration * 100).toFixed(0)}% faster!\n`);
  
  console.log('=== Test 2: Dependencies & Parallel Groups ===\n');
  
  const stepA = createStep('auth', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { token: 'abc123' };
  });
  
  const stepB = createStep('userProfile', async (context) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return { name: 'John', token: context.results.auth.data.token };
  }, { dependsOn: ['auth'] });
  
  const stepC = createStep('userOrders', async (context) => {
    await new Promise(resolve => setTimeout(resolve, 120));
    return { orders: [1, 2, 3], user: context.results.userProfile.data.name };
  }, { dependsOn: ['userProfile'] });
  
  const stepD = createStep('recommendations', async () => {
    await new Promise(resolve => setTimeout(resolve, 80));
    return { items: ['item1', 'item2'] };
  });
  
  const stepE = createStep('notifications', async (context) => {
    await new Promise(resolve => setTimeout(resolve, 90));
    const user = context.results.userProfile?.data?.name || 'guest';
    return { sentTo: user };
  }, { dependsOn: ['userProfile'] });
  
  console.log('Steps with dependencies:');
  console.log('  auth → userProfile → userOrders');
  console.log('  auth → userProfile → notifications');
  console.log('  recommendations (independent)');
  console.log('\nExpected parallel groups:');
  console.log('  Group 1: [auth, recommendations] (parallel)');
  console.log('  Group 2: [userProfile] (after auth)');
  console.log('  Group 3: [userOrders, notifications] (parallel after userProfile)\n');
  
  const result3 = await orchestrate([stepA, stepB, stepC, stepD, stepE], {
    parallel: true,
    maxConcurrent: 2,
    logger: {
      info: (msg: string) => console.log(`  🔄 ${msg}`)
    }
  });
  
  console.log('✅ All steps completed!');
  console.log(`Total duration: ${result3.duration}ms`);
  
  console.log('\n=== Test 3: Limited Concurrency ===\n');
  
  const steps = Array.from({ length: 6 }, (_, i) => 
    createStep(`task${i + 1}`, async () => {
      const delay = 100 + (i * 20);
      await new Promise(resolve => setTimeout(resolve, delay));
      return { task: i + 1, delay };
    })
  );
  
  console.log('Running 6 tasks with max 2 concurrent:');
  const startLimited = Date.now();
  await orchestrate(steps, {
    parallel: 2, // Limit to 2 concurrent tasks
    logger: {
      info: () => {} // Silent mode
    }
  });
  const limitedDuration = Date.now() - startLimited;
  
  console.log('Running 6 tasks fully parallel:');
  const startFull = Date.now();
  await orchestrate(steps, {
    parallel: true,
    logger: {
      info: () => {}
    }
  });
  const fullDuration = Date.now() - startFull;
  
  console.log(`  Limited (2 concurrent): ${limitedDuration}ms`);
  console.log(`  Fully parallel: ${fullDuration}ms`);
  console.log(`  Difference: ${limitedDuration - fullDuration}ms`);
  
  console.log('\n🎯 Day 5 Complete!');
  console.log('✅ Parallel execution with dependency analysis');
  console.log('✅ Controlled concurrency limits');
  console.log('✅ Sequential fallback mode');
  console.log('✅ Performance optimization');
}

demo().catch(console.error);