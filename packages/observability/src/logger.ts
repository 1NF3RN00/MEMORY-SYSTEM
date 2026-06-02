import pino, { type Logger as PinoLogger, type LoggerOptions as PinoLoggerOptions } from "pino";

export interface LoggerOptions {
  level?: string;
  service?: string;
  baseContext?: Record<string, unknown>;
}

export type Logger = PinoLogger;

export function createLogger(options: LoggerOptions = {}): Logger {
  const pinoOptions: PinoLoggerOptions = {
    level: options.level ?? "info",
    base: {
      service: options.service ?? "memory-middleware",
      ...options.baseContext,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };

  return pino(pinoOptions);
}
