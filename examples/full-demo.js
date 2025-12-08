"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const metrics_1 = require("../src/plugins/metrics");
const stripe_1 = require("../src/plugins/stripe");
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
        (0, src_1.createStep)('bootstrap', async () => ({ baseUrl: 'https://api.service.dev', token: 'tkn' })),
        (0, src_1.createStep)('listCustomers', async ({ get }) => {
            callCount += 1;
            if (callCount < 2) {
                const err = new Error('rate limited');
                err.status = 429;
                err.headers = { 'retry-after': '0.2' };
                throw err;
            }
            const auth = get('bootstrap');
            return { customers: [{ id: 'cus_1', token: auth?.token }] };
        }, { retries: 2, parallel: true }),
        (0, src_1.createStep)('createInvoice', async ({ get }) => {
            const customers = get('listCustomers')?.customers ?? [];
            return customers.map((c) => ({ customerId: c.id, invoiceId: `inv_${Date.now()}` }));
        }, { parallel: true }),
    ];
    const result = await (0, src_1.orchestrate)(steps, {
        retries: 2,
        plugins: [(0, src_1.loggingPlugin)(), (0, metrics_1.createMetricsPlugin)(metricsStore), (0, stripe_1.stripePlugin)()],
        throttle: { concurrency: 2, perSecond: 5 },
    });
    console.log('results', result.results);
    console.log('metrics', metricsStore);
    console.log('events', result.getEvents());
}
void main();
