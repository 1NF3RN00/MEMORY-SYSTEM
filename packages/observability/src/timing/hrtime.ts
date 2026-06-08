export function nowHr(): bigint {
  return process.hrtime.bigint();
}

export function hrToMs(start: bigint, end: bigint): number {
  const ns = end - start;
  return Math.round((Number(ns) / 1_000_000) * 1000) / 1000;
}

export function isoNow(): string {
  return new Date().toISOString();
}
