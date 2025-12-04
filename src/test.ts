import { orchestrate } from './index';

const step1 = async () => 'Result 1';
const step2 = async () => 'Result 2';

orchestrate([step1, step2]).then(console.log);