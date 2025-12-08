"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
async function main() {
    const steps = [
        (0, src_1.createStep)('getConfig', async () => ({ region: 'us-east-1' })),
        (0, src_1.createStep)('callApi', async ({ get }) => {
            const cfg = get('getConfig');
            return { ok: true, region: cfg?.region };
        }),
    ];
    const result = await (0, src_1.orchestrate)(steps, {
        plugins: [(0, src_1.loggingPlugin)()],
    });
    console.log('results', result.results);
}
void main();
