#!/usr/bin/env node
/**
 * Email wave completion summary via Resend.
 *
 * Env (.env):
 *   RESEND_API_KEY=re_...
 *   PERF_NOTIFY_EMAIL=you@domain.com
 *   RESEND_FROM_EMAIL=Perf Bot <onboarding@resend.dev>   # or your verified domain
 *   PERF_TRIGGER_BASE_URL=https://your-api.example.com   # optional: magic links
 *   PERF_TRIGGER_SECRET=long-random-string               # optional: HMAC for links
 *
 * Usage:
 *   node scripts/performance-sprints/notify-wave.mjs --wave 1
 *   node scripts/performance-sprints/notify-wave.mjs --wave 1 --dry-run
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadProjectEnv, REPO_ROOT } from "./load-env.mjs";
import { collectWaveOutcomes, formatWaveMarkdown } from "./collect-wave-outcomes.mjs";
import { buildPlainTextReport, buildWaveEmailHtml } from "./wave-email-template.mjs";

loadProjectEnv();

function signWaveToken(wave, secret) {
  return crypto.createHmac("sha256", secret).update(`wave:${wave}`).digest("hex").slice(0, 32);
}

function buildTriggerUrl(wave) {
  const base = (
    process.env.PERF_TRIGGER_PUBLIC_URL ?? process.env.PERF_TRIGGER_BASE_URL
  )?.replace(/\/$/, "");
  const secret = process.env.PERF_TRIGGER_SECRET;
  if (!base || !secret) return null;
  const token = signWaveToken(wave, secret);
  const nextWave = Number(wave) + 1;
  if (nextWave > 7) return null;
  return `${base}/perf/trigger?wave=${nextWave}&token=${token}`;
}

async function sendResend({ to, from, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  const waveArg = process.argv.find((a, i) => process.argv[i - 1] === "--wave");
  const dryRun = process.argv.includes("--dry-run");
  if (!waveArg) {
    console.error("Usage: node notify-wave.mjs --wave <1-7> [--dry-run]");
    process.exit(1);
  }

  const summary = collectWaveOutcomes(waveArg);
  const markdown = formatWaveMarkdown(summary);
  const triggerUrl = buildTriggerUrl(summary.wave);
  const html = buildWaveEmailHtml(summary, triggerUrl);
  const plainText = buildPlainTextReport(summary);

  const outDir = path.join(REPO_ROOT, "docs/performance-improvments/wave-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `wave-${waveArg}-outcomes.md`);
  fs.writeFileSync(reportPath, markdown);
  console.log(`Wrote ${reportPath}`);

  if (dryRun) {
    const preview = path.join(outDir, `wave-${waveArg}-email.html`);
    fs.writeFileSync(preview, html);
    console.log(`Dry run: wrote ${preview}`);
    if (triggerUrl) console.log(`Trigger URL: ${triggerUrl}`);
    return;
  }

  const to = process.env.PERF_NOTIFY_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL ?? "Perf Bot <onboarding@resend.dev>";
  if (!to) {
    console.error("PERF_NOTIFY_EMAIL not set — skipping send (report saved).");
    process.exit(0);
  }

  const subject = `semantic-core · Wave ${waveArg} report — ${summary.completedCount}/${summary.sprintCount} verified${summary.averageScore != null ? ` · ${summary.averageScore} avg` : ""}`;
  const result = await sendResend({
    to,
    from,
    subject,
    html,
    text: plainText,
  });
  console.log("Email sent:", result.id ?? result);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
