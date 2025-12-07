import { StepConfig, StepDependencyGraph, ParallelExecutionGroup } from '../types';

export class DependencyAnalyzer {
  /**
   * Build dependency graph from steps
   */
  buildDependencyGraph(steps: StepConfig[]): StepDependencyGraph {
    const graph: StepDependencyGraph = {};
    
    for (const step of steps) {
      graph[step.name] = step.dependsOn || [];
    }
    
    return graph;
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependencies(graph: StepDependencyGraph): { hasCycle: boolean; cycle?: string[] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycle: string[] = [];

    const dfs = (node: string): boolean => {
      if (!visited.has(node)) {
        visited.add(node);
        recursionStack.add(node);
        cycle.push(node);

        const neighbors = graph[node] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && dfs(neighbor)) {
            return true;
          } else if (recursionStack.has(neighbor)) {
            // Found a cycle
            cycle.push(neighbor);
            return true;
          }
        }
        
        recursionStack.delete(node);
        cycle.pop();
      }
      return false;
    };

    for (const node of Object.keys(graph)) {
      if (dfs(node)) {
        return { hasCycle: true, cycle: [...new Set(cycle)] };
      }
    }
    
    return { hasCycle: false };
  }

  /**
   * Group steps for parallel execution
   */
  groupForParallelExecution(steps: StepConfig[]): ParallelExecutionGroup[] {
    const graph = this.buildDependencyGraph(steps);
    const { hasCycle, cycle } = this.hasCircularDependencies(graph);
    
    if (hasCycle) {
      throw new Error(`Circular dependency detected: ${cycle?.join(' -> ')}`);
    }

    const stepMap = new Map<string, StepConfig>();
    for (const step of steps) {
      stepMap.set(step.name, step);
    }

    const completed = new Set<string>();
    const groups: ParallelExecutionGroup[] = [];
    
    while (completed.size < steps.length) {
      const currentGroup: StepConfig[] = [];
      const groupDependsOn: string[] = [];
      
      for (const step of steps) {
        if (completed.has(step.name)) continue;
        
        const dependencies = step.dependsOn || [];
        const allDependenciesMet = dependencies.every(dep => completed.has(dep));
        
        if (allDependenciesMet) {
          currentGroup.push(step);
          groupDependsOn.push(...dependencies.filter(dep => !completed.has(dep)));
        }
      }
      
      if (currentGroup.length === 0) {
        throw new Error('Cannot resolve dependencies. Possible circular dependency.');
      }
      
      groups.push({
        steps: currentGroup,
        canExecute: true,
        dependsOn: [...new Set(groupDependsOn)]
      });
      
      for (const step of currentGroup) {
        completed.add(step.name);
      }
    }
    
    return groups;
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder(steps: StepConfig[]): string[] {
    const graph = this.buildDependencyGraph(steps);
    const visited = new Set<string>();
    const order: string[] = [];
    
    const dfs = (node: string) => {
      visited.add(node);
      const neighbors = graph[node] || [];
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      
      order.push(node);
    };
    
    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    
    return order.reverse();
  }
}