import type { ExecutionStageTiming, ExecutionTimingAudit } from "@memory-middleware/shared-types";
import { hrToMs, isoNow, nowHr } from "./hrtime.js";

interface ActiveStage {
  startTime: string;
  startHr: bigint;
}

export class ExecutionTimingCollector {
  private readonly requestId: string;
  private readonly requestStartHr: bigint;
  private readonly requestStartTime: string;
  private readonly active = new Map<string, ActiveStage>();
  private readonly completed: ExecutionStageTiming[] = [];

  constructor(requestId: string) {
    this.requestId = requestId;
    this.requestStartHr = nowHr();
    this.requestStartTime = isoNow();
  }

  startStage(stage: string): void {
    if (this.active.has(stage)) return;
    this.active.set(stage, { startTime: isoNow(), startHr: nowHr() });
  }

  endStage(stage: string): void {
    const active = this.active.get(stage);
    if (!active) return;
    const endHr = nowHr();
    this.completed.push({
      stage,
      startTime: active.startTime,
      endTime: isoNow(),
      durationMs: hrToMs(active.startHr, endHr),
    });
    this.active.delete(stage);
  }

  measure<T>(stage: string, fn: () => T): T {
    this.startStage(stage);
    try {
      return fn();
    } finally {
      this.endStage(stage);
    }
  }

  async measureAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    this.startStage(stage);
    try {
      return await fn();
    } finally {
      this.endStage(stage);
    }
  }

  mergeStages(stages: ExecutionStageTiming[]): void {
    this.completed.push(...stages);
  }

  toAudit(): ExecutionTimingAudit {
    const endHr = nowHr();
    return {
      requestId: this.requestId,
      totalLatency: hrToMs(this.requestStartHr, endHr),
      stages: [...this.completed],
    };
  }

  getRequestStartTime(): string {
    return this.requestStartTime;
  }
}
