export function createStep(name: string, execute: any, config?: any) { 
  return { 
    name, 
    execute, 
    ...config 
  }; 
} 
