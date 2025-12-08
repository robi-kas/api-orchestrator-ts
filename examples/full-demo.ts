import { orchestrate, createStep, loggingPlugin } from '../src';
import { createMetricsPlugin } from '../src/plugins/metrics';
import { stripePlugin } from '../src/plugins/stripe';

async function main() {
  const metricsStore = {
    stepsStarted: 0,
    stepsSucceeded: 0,
    stepsFailed: 0,
    retries: 0,
    timeouts: 0,
    rateLimits: 0,
  };

  let callCount = 0;

  const steps = [
    createStep('bootstrap', async () => ({ baseUrl: 'https://api.service.dev', token: 'tkn' })),
    createStep(
      'listCustomers',
      async ({ get }) => {
        callCount += 1;
        if (callCount < 2) {
          const err: any = new Error('rate limited');
          err.status = 429;
          err.headers = { 'retry-after': '0.2' };
          throw err;
        }
        const auth = get<{ token: string }>('bootstrap');
        return { customers: [{ id: 'cus_1', token: auth?.token }] };
      },
      { retries: 2, parallel: true },
    ),
    createStep(
      'createInvoice',
      async ({ get }) => {
        const customers = get<{ customers: Array<{ id: string }> }>('listCustomers')?.customers ?? [];
        return customers.map((c) => ({ customerId: c.id, invoiceId: `inv_${Date.now()}` }));
      },
      { parallel: true },
    ),
  ];

  const result = await orchestrate(steps, {
    retries: 2,
    plugins: [loggingPlugin(), createMetricsPlugin(metricsStore), stripePlugin()],
    throttle: { concurrency: 2, perSecond: 5 },
  });

  console.log('results', result.results);
  console.log('metrics', metricsStore);
  console.log('events', result.getEvents());
}

void main();

