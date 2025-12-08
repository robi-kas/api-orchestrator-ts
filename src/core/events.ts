import { TelemetryEvent } from '../types';

export class EventBus {
  private readonly events: TelemetryEvent[] = [];

  log(type: TelemetryEvent['type'], data: Omit<TelemetryEvent, 'timestamp' | 'type'> = {}): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      ...data,
    });
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  getVisualization(): Array<{ label: string; time: number; data?: Record<string, unknown> }> {
    return this.events.map((event) => ({
      label: event.type,
      time: event.timestamp,
      data: event.data,
    }));
  }
}

