#!/usr/bin/env node
/**
 * Run a wave of sprints: implement then verify for each, sequentially.
 *
 * Usage:
 *   node scripts/performance-sprints/run-wave.mjs --wave 1
 *   node scripts/performance-sprints/run-wave.mjs --sprints 01,02,03
 *   node scripts/performance-sprints/run-wave.mjs --wave 1 --implement-only
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { loadProjectEnv } from "./load-env.mjs";
import { getWaveSprints, listWavesForHelp, loadWaves } from "./load-waves.mjs";

loadProjectEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUN_SPRINT = path.join(__dirname, "run-sprint.mjs");
const NOTIFY_WAVE = path.join(__dirname, "notify-wave.mjs");

function parseArgs(argv) {
  const args = {
    wave: null,
    sprints: null,
    implementOnly: false,
    verifyOnly: false,
    dryRun: false,
    noNotify: false,
    model: "composer-2.5",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--wave" && argv[i + 1]) args.wave = argv[++i];
    else if (a === "--sprints" && argv[i + 1]) args.sprints = argv[++i].split(",").map((s) => s.trim().padStart(2, "0"));
    else if (a === "--implement-only") args.implementOnly = true;
    else if (a === "--verify-only") args.verifyOnly = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-notify") args.noNotify = true;
    else if (a === "--model" && argv[i + 1]) args.model = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function runNode(scriptArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, scriptArgs, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`exit ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(`Usage:
  node scripts/performance-sprints/run-wave.mjs --wave 1
  node scripts/performance-sprints/run-wave.mjs --sprints 01,02,03
  Options: --implement-only | --verify-only | --dry-run | --no-notify | --model <id>

Waves (see docs/performance-improvments/WAVES.md):
${listWavesForHelp()}
`);
    process.exit(0);
  }

  const sprints = args.sprints ?? (args.wave ? getWaveSprints(args.wave) : null);
  if (!sprints?.length) {
    console.error("Specify --wave <1-7> or --sprints 01,02,...");
    process.exit(1);
  }

  const phases = args.verifyOnly ? ["verify"] : args.implementOnly ? ["implement"] : ["implement", "verify"];

  console.log(`Sprints: ${sprints.join(", ")}`);
  console.log(`Phases: ${phases.join(" → ")}\n`);

  for (const sprint of sprints) {
    for (const phase of phases) {
      console.log(`\n========== Sprint ${sprint} / ${phase} ==========\n`);
      const scriptArgs = [RUN_SPRINT, "--sprint", sprint, "--phase", phase, "--model", args.model];
      if (args.dryRun) scriptArgs.push("--dry-run");

      try {
        await runNode(scriptArgs);
      } catch (err) {
        console.error(`Failed sprint ${sprint} ${phase}: ${err.message}`);
        console.error("Stopping wave. Fix outcomes.md and resume with --sprints");
        process.exit(2);
      }
    }
  }

  console.log("\nWave complete.");

  const waveNum = args.wave ?? null;
  if (!args.noNotify && waveNum && !args.dryRun) {
    console.log("\nSending wave notification...");
    const notifyArgs = [NOTIFY_WAVE, "--wave", String(waveNum)];
    try {
      await runNode(notifyArgs);
    } catch (err) {
      console.warn(`Notification failed (wave still complete): ${err.message}`);
    }
  }
}

main();
