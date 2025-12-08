"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const steps = [
        (0, src_1.createStep)('warmup', async () => 'ready'),
        (0, src_1.createStep)('batchA', async () => {
            await new Promise((r) => setTimeout(r, 200));
            return [1, 2, 3];
        }, { parallel: true }),
        (0, src_1.createStep)('batchB', async () => {
            await new Promise((r) => setTimeout(r, 150));
            return ['a', 'b'];
        }, { parallel: true }),
        (0, src_1.createStep)('combine', async ({ get }) => {
            const a = get('batchA') ?? [];
            const b = get('batchB') ?? [];
            return { size: a.length + b.length };
        }),
    ];
    const result = await (0, src_1.orchestrate)(steps, { throttle: { concurrency: 2 } });
    console.log(result.results);
}
void main();
