@echo off
echo 🔧 Fixing run issues...

REM Make sure we're in project root
cd /d "C:\Users\Robi\Desktop\api-orchestrator-ts"

REM Update package.json scripts
echo {
echo   "name": "api-orchestrator-ts",
echo   "version": "0.1.0",
echo   "description": "A lightweight TypeScript library for managing complex API workflows",
echo   "main": "dist/index.js",
echo   "types": "dist/index.d.ts",
echo   "scripts": {
echo     "build": "tsc",
echo     "dev": "tsc --watch",
echo     "test": "jest",
echo     "start": "node dist/index.js",
echo     "example": "npx ts-node ./examples/basic-usage.ts",
echo     "clean": "rm -rf dist"
echo   },
echo   "keywords": ["api", "orchestration", "typescript", "workflow"],
echo   "author": "Robi Kas",
echo   "license": "MIT",
echo   "devDependencies": {
echo     "@types/node": "^20.0.0",
echo     "typescript": "^5.0.0",
echo     "ts-node": "^10.9.0"
echo   },
echo   "dependencies": {
echo     "p-retry": "^5.0.0",
echo     "p-queue": "^7.0.0"
echo   },
echo   "engines": {
echo     "node": ">=16.0.0"
echo   }
echo } > package.json

REM Create example folder if it doesn't exist
if not exist examples mkdir examples

REM Create simple working example
echo import { orchestrate, createStep } from '../src/index'; > examples\basic-usage.ts
echo >> examples\basic-usage.ts
echo console.log('🚀 Testing API Orchestrator...'); >> examples\basic-usage.ts
echo >> examples\basic-usage.ts
echo const testStep = createStep('test', async () => { >> examples\basic-usage.ts
echo   console.log('Step executing...'); >> examples\basic-usage.ts
echo   return { message: 'Hello from API Orchestrator!' }; >> examples\basic-usage.ts
echo }); >> examples\basic-usage.ts
echo >> examples\basic-usage.ts
echo async function main() { >> examples\basic-usage.ts
echo   const result = await orchestrate([testStep]); >> examples\basic-usage.ts
echo   console.log('✅ Result:', result); >> examples\basic-usage.ts
echo } >> examples\basic-usage.ts
echo >> examples\basic-usage.ts
echo main().catch(console.error); >> examples\basic-usage.ts

REM Build first
echo Building project...
call npm run build

echo.
echo ✅ Fixed! Now run:
echo npm run example