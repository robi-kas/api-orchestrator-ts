"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const steps = [
        (0, src_1.createStep)('slowCall', async () => {
            await new Promise((_, reject) => setTimeout(() => reject(new Error('Too slow')), 1500));
            return 'never';
        }, { timeout: 500, fallbackValue: 'fallback-response' }),
    ];
    const result = await (0, src_1.orchestrate)(steps, { timeout: 1000 });
    console.log(result.results);
    console.log('events', result.getEvents());
}
void main();
