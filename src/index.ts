export async function orchestrate(
  steps: Array<() => Promise<any>>,
  options: { retries?: number } = { retries: 0 }
): Promise<any[]> {
  const results: any[] = [];
  for (const step of steps) {
    try {
      const result = await step();  // yhen run each step sequentially
      results.push(result);
    } catch (error) {
      // buhala placeholder for retries/fallbacks later
      console.error('Step failed:', error);
      throw error;  // For now, just throw to halt
    }
  }
  return results;
}