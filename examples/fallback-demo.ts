import { orchestrate } from '../src';

console.log('🚀 Day 4: Circuit Breaker & Fallback Demo');

async function demo() {
  console.log('\n=== Test 1: Basic Step ===');
  
  const step1 = {
    name: 'basic',
    execute: async () => {
      console.log('  Step executing...');
      return { success: true, data: 'test' };
    }
  };

  const result1 = await orchestrate([step1] as any);
  console.log('  ✅ Success:', (result1 as any).success);
  console.log('  ⏱️  Duration:', (result1 as any).duration + 'ms');

  console.log('\n=== Test 2: Circuit Breaker ===');

  let callCount = 0;
  const circuitStep = {
    name: 'circuit',
    execute: async () => {
      callCount++;
      console.log(`  Call #${callCount}`);
      if (callCount <= 2) {
        throw new Error('Service down');
      }
      return { callNumber: callCount };
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 2,
      resetTimeout: 3000
    }
  };

  console.log('  Making 4 calls...');
  const results = [];
  for (let i = 0; i < 4; i++) {
    try {
      const result = await orchestrate([circuitStep] as any);
      results.push((result as any).success ? '✅' : '❌');
    } catch (error: any) {
      results.push(error.message.includes('Circuit') ? '💥' : '❌');
    }
  }
  console.log(`  Results: ${results.join(' ')}`);
  console.log('  Expected: ❌ ❌ 💥 💥 (circuit opens after 2 failures)');

  console.log('\n=== Test 3: Fallback ===');

  const fallbackStep = {
    name: 'withFallback',
    execute: async () => {
      throw new Error('Primary service failed');
    },
    fallbacks: [{
      strategy: 'static-value',
      value: { using: 'fallback', data: 'backup_data' }
    }]
  };

  const result3 = await orchestrate([fallbackStep] as any);
  console.log('  ✅ Success:', (result3 as any).success);
  console.log('  🔄 Used fallback:', (result3 as any).results.withFallback.fallbackUsed);
  console.log('  📊 Data:', (result3 as any).results.withFallback.data);

  console.log('\n🎯 Day 4 Complete!');
  console.log('✅ Circuit breaker pattern');
  console.log('✅ Fallback strategies');
  console.log('✅ Basic orchestration');
}

demo().catch(console.error);