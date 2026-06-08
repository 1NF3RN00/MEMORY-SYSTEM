#!/usr/bin/env node
/**
 * Test remote perf trigger URL (ngrok). Usage:
 *   node scripts/performance-sprints/test-trigger.mjs --wave 2
 */

import crypto from "crypto";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

const waveArg = process.argv.find((a, i) => process.argv[i - 1] === "--wave") ?? "2";
const wave = Number(waveArg);
const secret = process.env.PERF_TRIGGER_SECRET;
const base = (process.env.PERF_TRIGGER_PUBLIC_URL ?? process.env.PERF_TRIGGER_BASE_URL)?.replace(
  /\/$/,
  "",
);

if (!secret || !base) {
  console.error("Missing PERF_TRIGGER_SECRET or PERF_TRIGGER_PUBLIC_URL in .env");
  process.exit(1);
}

const token = crypto.createHmac("sha256", secret).update(`wave:${wave}`).digest("hex").slice(0, 32);
const url = `${base}/perf/trigger?wave=${wave}&token=${token}`;

console.log("Testing:", url);

const res = await fetch(url, {
  headers: { "ngrok-skip-browser-warning": "1" },
});
const text = await res.text();

console.log("HTTP status:", res.status);
if (res.status === 200 && text.includes(`Wave ${wave}`)) {
  console.log("OK — trigger endpoint reachable and accepted token.");
  process.exit(0);
}
if (res.status === 403) {
  console.error("FAIL — 403 Unauthorized (token/secret mismatch or API old code)");
  process.exit(1);
}
console.error("Unexpected response (first 500 chars):", text.slice(0, 500));
process.exit(1);
