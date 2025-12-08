"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const steps = [
        (0, src_1.createStep)('primaryApi', async () => {
            throw Object.assign(new Error('Primary offline'), { status: 503 });
        }, {
            retries: 1,
            fallbackStep: async () => ({ source: 'cache', value: 42 }),
        }),
    ];
    const result = await (0, src_1.orchestrate)(steps);
    console.log(result.results);
}
void main();
