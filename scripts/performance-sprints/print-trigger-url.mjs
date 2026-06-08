#!/usr/bin/env node
/** Print the email "Start Wave N" URL for testing on your phone. */
import crypto from "crypto";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

const wave = Number(process.argv.find((a, i) => process.argv[i - 1] === "--wave") ?? "2");
const secret = process.env.PERF_TRIGGER_SECRET;
const base = (process.env.PERF_TRIGGER_PUBLIC_URL ?? process.env.PERF_TRIGGER_BASE_URL)?.replace(
  /\/$/,
  "",
);

if (!secret || !base) {
  console.error("Set PERF_TRIGGER_PUBLIC_URL and PERF_TRIGGER_SECRET in .env");
  process.exit(1);
}

const token = crypto.createHmac("sha256", secret).update(`wave:${wave}`).digest("hex").slice(0, 32);
console.log(`${base}/perf/trigger?wave=${wave}&token=${token}`);
