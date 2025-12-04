# API Orchestrator TS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/robi-kas/api-orchestrator-ts)](https://github.com/robi-kas/api-orchestrator-ts/stargazers)

A lightweight TypeScript library for managing complex API workflows. Simplify chaining multiple API calls, handling errors, retries, and fallbacks.

## 🚀 Features

- **Declarative API**: Chain async steps with clean syntax
- **Auto Retry**: Exponential backoff with configurable attempts
- **Fallback Support**: Graceful degradation when APIs fail
- **Parallel Execution**: Run independent steps concurrently
- **Type Safe**: Full TypeScript support
- **Plugin System**: Extend with custom functionality
- **Framework Agnostic**: Works with Express, Next.js, plain Node.js

## 📦 Installation

```bash
npm install api-orchestrator-ts
```
## 🚀 Quick Start

```ts
import { orchestrate, createStep } from 'api-orchestrator-ts';

// Step 1: Authenticate
const authStep = createStep('auth', async () => {
  const res = await fetch('https://api.example.com/auth', {
    method: 'POST',
    body: JSON.stringify({ username: 'user', password: 'pass' })
  });

  return res.json();
});

// Step 2: Fetch data using token
const fetchDataStep = createStep('fetchData', async (context) => {
  const token = context.results.auth.data.token;

  const res = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${token}` }
  });

  return res.json();
});

// Run workflow
async function main() {
  const result = await orchestrate(
    [authStep, fetchDataStep],
    {
      maxRetries: 2,
      stopOnFailure: false
    }
  );

  console.log(result);
}

main();
```
#🔧 Step Definition
```ts 
const step = createStep(
  'stepName',
  async (context) => {
    return await api.call();
  },
  {
    retries: 3,
    timeout: 5000,
    dependsOn: ['previousStep'],
    fallback: async (error, context) => {
      return { fallback: true };
    }
  }
);
```
#⚙️ Configuration Options
```ts 
const config = {
  maxRetries: 3,
  timeout: 30000,
  parallel: false,
  stopOnFailure: false,
  sharedData: {
    requestId: '12345'
  }
};
```
#📚 Examples
E-commerce Checkout Flow
```ts 
const checkoutFlow = await orchestrate([
  createStep('validateCart', async () => {
    return { valid: true, items: 3 };
  }),

  createStep(
    'processPayment',
    async (context) => {
      return await stripe.charges.create({ amount: 5000, currency: 'usd' });
    },
    {
      retries: 3,
      fallback: async () => {
        return await paypal.charges.create({});
      }
    }
  ),

  createStep('sendConfirmation', async () => {
    return await emailService.send({
      to: 'customer@example.com',
      template: 'order-confirmation'
    });
  })
]);
```
#🧩 Plugins
```ts
const loggingPlugin = {
  name: 'logging',

  beforeStep: async (step) => {
    console.log(`Starting: ${step.name}`);
  },

  afterStep: async (step, result) => {
    console.log(`Completed: ${step.name}`, {
      status: result.status,
      duration: result.duration
    });
  }
};

const result = await orchestrate(steps, {
  plugins: [loggingPlugin]
});
```
#🧪 Testing
```ts 
const result = await orchestrate([
  createStep('testStep', async () => 'test-data')
]);

expect(result.success).toBe(true);
expect(result.results.testStep.data).toBe('test-data');
```
#🤝 Contributing
We're in a ** 30-Day Commit Challenge** — feel free to join!

    Fork this repository

    Create a feature branch

    Commit your changes

    Push the branch

    Open a Pull Request

#📅 30-Day Progress

Day 1: Project setup

Day 2: Core orchestrate API

Day 3: Retry logic

Day 4: Fallback support

Day 5: Parallel execution

More coming…

#📄 License

**MIT © Robi Kas**

🌟 Support

⭐ Star the repo

🐦 Follow on X: @[robi_kass](https://x.com/robi_kass)

🐛 Report issues

💻 Contribute
