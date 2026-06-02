import "./load-env.js";
import { z } from "zod";
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    API_HOST: z.ZodDefault<z.ZodString>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    TRACE_HEADER: z.ZodDefault<z.ZodString>;
    OPENAI_API_KEY: z.ZodOptional<z.ZodString>;
    WORKER_POLL_INTERVAL_MS: z.ZodDefault<z.ZodNumber>;
    TEMPORARY_MEMORY_TTL_MS: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "debug" | "info" | "warn" | "error";
    API_HOST: string;
    API_PORT: number;
    DATABASE_URL: string;
    TRACE_HEADER: string;
    WORKER_POLL_INTERVAL_MS: number;
    TEMPORARY_MEMORY_TTL_MS: number;
    OPENAI_API_KEY?: string | undefined;
}, {
    DATABASE_URL: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error" | undefined;
    API_HOST?: string | undefined;
    API_PORT?: number | undefined;
    TRACE_HEADER?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
    WORKER_POLL_INTERVAL_MS?: number | undefined;
    TEMPORARY_MEMORY_TTL_MS?: number | undefined;
}>;
export type AppEnv = z.infer<typeof envSchema>;
export declare function loadEnv(): AppEnv;
export {};
//# sourceMappingURL=env.d.ts.map