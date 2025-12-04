# API Orchestrator TS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-16+-green)](https://nodejs.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](https://opensource.org/licenses/MIT) [![GitHub stars](https://img.shields.io/github/stars/robi-kas/api-orchestrator-ts)](https://github.com/robi-kas/api-orchestrator-ts/stargazers)

A lightweight, TypeScript-first library to define and run complex API workflows. Orchestrate chained and parallel steps with built-in retries, fallbacks, timeouts, and plugins — keeping your integration logic declarative and type-safe.

## Table of Contents

- Features
- Installation
- Quick Start
- API (overview)
- Step definition
- Configuration
- Examples
- Plugins
- Testing
- Contributing
- License & Support

## Features

- Declarative workflow definitions for async steps
- Configurable retries with exponential backoff
- Built-in fallback handlers for graceful degradation
- Parallel and sequential execution modes
- Full TypeScript types and IDE-friendly DX
- Plugin hooks for logging, metrics, etc.
- Framework agnostic (Node, Express, Next.js)

## Installation

Install from npm:

```bash
npm install api-orchestrator-ts
# or
yarn add api-orchestrator-ts
```

## Quick Start

```ts
import { orchestrate, createStep } from 'api-orchestrator-ts';

const auth = createStep('auth', async () => {
    const res = await fetch('https://api.example.com/auth', {
        method: 'POST',
        body: JSON.stringify({ username: 'user', password: 'pass' })
    });
    return res.json();
});

const fetchData = createStep('fetchData', async (context) => {
    const token = context.results.auth.data.token;
    const res = await fetch('https://api.example.com/data', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
});

async function main() {
    const result = await orchestrate([auth, fetchData], { maxRetries: 2 });
    console.log(result);
}

main();
```

## API (overview)

- createStep(name, handler, options?) — create a reusable workflow step.
- orchestrate(steps[], options?) — run a workflow and return aggregated results.

Return shape (example):
```ts
{
    success: boolean,
    results: {
        [stepName]: { status: 'success' | 'failed', data?: any, error?: any }
    },
    durationMs: number
}
```

## Step definition

```ts
const step = createStep(
    'stepName',
    async (context) => {
        // context.sharedData, context.results, etc.
        return await api.call();
    },
    {
        retries: 3,
        timeout: 5000,
        dependsOn: ['previousStep'],
        fallback: async (error, context) => ({ fallback: true })
    }
);
```

## Configuration options

Common orchestrate-level options:

```ts
const config = {
    maxRetries: 3,
    timeout: 30000,
    parallel: false,        // run independent steps in parallel
    stopOnFailure: false,   // whether to abort on the first failure
    sharedData: { requestId: '12345' },
    plugins: []             // plugin hooks
};
```

Step-level options override orchestrate defaults.

## Examples

E-commerce checkout flow (illustrative):

```ts
const checkout = await orchestrate([
    createStep('validateCart', async () => ({ valid: true, items: 3 })),

    createStep('processPayment', async (context) => {
        return await stripe.charges.create({ amount: 5000, currency: 'usd' });
    }, {
        retries: 3,
        fallback: async () => {
            // fallback to alternative gateway
            return await paypal.charges.create({ amount: 5000 });
        }
    }),

    createStep('sendConfirmation', async () => {
        return await emailService.send({
            to: 'customer@example.com',
            template: 'order-confirmation'
        });
    })
], { maxRetries: 2 });
```

## Plugins

Plugins can hook into the lifecycle to add logging, metrics, or tracing.

```ts
const loggingPlugin = {
    name: 'logging',
    beforeStep: async (step) => console.log(`Starting: ${step.name}`),
    afterStep: async (step, result) => console.log(`Completed: ${step.name}`, result)
};

const result = await orchestrate(steps, { plugins: [loggingPlugin] });
```

Plugin hooks (examples): beforeWorkflow, afterWorkflow, beforeStep, afterStep, onError.

## Testing

Example test using your test runner:

```ts
const result = await orchestrate([
    createStep('testStep', async () => 'test-data')
]);

expect(result.success).toBe(true);
expect(result.results.testStep.data).toBe('test-data');
```

Design your tests to stub external APIs and assert retry/fallback behavior.

## Contributing

Contributions are welcome. Suggested workflow:

1. Fork the repository
2. Create a feature branch (feature/...)
3. Implement changes and add tests
4. Run linting and tests locally
5. Open a pull request with a clear description

Please follow the existing code style and include tests for new behaviors.

## Roadmap & Progress

- Core orchestrate API
- Retry & backoff strategies
- Fallback support
- Parallel execution
- Plugin ecosystem
- CI, benchmarks, and examples

(See project milestones and issues for details.)

## License

MIT © Robi Kas

## Support

- Star the repository to show support
- Report issues or feature requests on GitHub
- Follow on X: [@robi_kass](https://x.com/robi_kass)

Contact contributions and bug reports via GitHub issues.

