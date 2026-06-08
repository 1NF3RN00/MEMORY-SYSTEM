#!/usr/bin/env node
/**
 * Run one performance-improvement sprint pair (implement or verify) via @cursor/sdk.
 *
 * Usage:
 *   CURSOR_API_KEY=cursor_... node scripts/performance-sprints/run-sprint.mjs --sprint 01 --phase implement
 *   CURSOR_API_KEY=cursor_... node scripts/performance-sprints/run-sprint.mjs --sprint 03 --phase verify
 *   node scripts/performance-sprints/run-sprint.mjs --sprint 01 --phase implement --dry-run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadProjectEnv, REPO_ROOT } from "./load-env.mjs";
import {
  SPRINT_DISPOSE_TIMEOUT_MS,
  SPRINT_INACTIVITY_TIMEOUT_MS,
  SPRINT_MAX_TIMEOUT_MS,
  createInactivityGuard,
  disposeAgent,
  withTimeout,
} from "./sprint-timeouts.mjs";
import {
  formatDelta,
  formatStep,
  formatStreamEvent,
  isVerboseStream,
} from "./stream-log.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRINTS_ROOT = path.join(REPO_ROOT, "docs/performance-improvments");

loadProjectEnv();

function parseArgs(argv) {
  const args = { sprint: null, phase: null, dryRun: false, model: "composer-2.5" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sprint" && argv[i + 1]) args.sprint = argv[++i].padStart(2, "0");
    else if (a === "--phase" && argv[i + 1]) args.phase = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--model" && argv[i + 1]) args.model = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function findSprintDir(sprintNum) {
  const prefix = `sprint-${sprintNum}-`;
  const entries = fs.readdirSync(SPRINTS_ROOT, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && e.name.startsWith(prefix));
  if (!match) {
    throw new Error(`No sprint folder matching ${prefix}* in ${SPRINTS_ROOT}`);
  }
  return path.join(SPRINTS_ROOT, match.name);
}

function buildPrompt({ sprintDir, phase, sprintFolderName }) {
  const globalPrompt = fs.readFileSync(path.join(SPRINTS_ROOT, "GLOBAL_PROMPT.md"), "utf8");
  const sprintPrompt = fs.readFileSync(path.join(sprintDir, `${phase}.md`), "utf8");
  const outcomesPath = path.join(sprintDir, "outcomes.md");

  return `# Performance sprint run — ${sprintFolderName} — ${phase}

You are executing a structured performance improvement sprint in the semantic-core monorepo.

## Mandatory reading (follow exactly)

### GLOBAL_PROMPT.md
${globalPrompt}

---

### Sprint prompt (${phase}.md)
${sprintPrompt}

---

## Execution rules

1. Work only within this sprint's scope.
2. Edit \`${outcomesPath.replace(/\\/g, "/")}\` as you go (${phase === "implement" ? "Implementation summary + Anti-objectives avoided" : "Verification summary + Score + Measurements"}).
3. Run tests relevant to this sprint before finishing.
4. Do not start other sprints.
5. If blocked, document the blocker in outcomes.md and stop.

## Repo root
${REPO_ROOT.replace(/\\/g, "/")}

Begin now.
`;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.sprint || !args.phase) {
    console.log(`Usage:
  node scripts/performance-sprints/run-sprint.mjs --sprint 01 --phase implement|verify [--model composer-2.5] [--dry-run]

Environment:
  CURSOR_API_KEY   Required unless --dry-run

Examples:
  node scripts/performance-sprints/run-sprint.mjs --sprint 03 --phase implement
  node scripts/performance-sprints/run-sprint.mjs --sprint 03 --phase verify
`);
    process.exit(args.help ? 0 : 1);
  }

  if (!["implement", "verify"].includes(args.phase)) {
    console.error("--phase must be implement or verify");
    process.exit(1);
  }

  const sprintDir = findSprintDir(args.sprint);
  const sprintFolderName = path.basename(sprintDir);
  const prompt = buildPrompt({ sprintDir, phase: args.phase, sprintFolderName });

  if (args.dryRun) {
    const out = path.join(sprintDir, `_last-${args.phase}-prompt.md`);
    fs.writeFileSync(out, prompt);
    console.log(`Dry run: wrote ${out}`);
    console.log(`Prompt length: ${prompt.length} chars`);
    return;
  }

  if (!process.env.CURSOR_API_KEY) {
    console.error("CURSOR_API_KEY is not set.");
    console.error("Add to repo-root .env:  CURSOR_API_KEY=cursor_...");
    console.error("Or: $env:CURSOR_API_KEY='cursor_...'  (PowerShell)");
    console.error("Create a key at https://cursor.com/dashboard/integrations");
    process.exit(1);
  }

  let Agent;
  try {
    ({ Agent } = await import("@cursor/sdk"));
  } catch {
    console.error("@cursor/sdk is not installed. Run: npm install -D @cursor/sdk");
    process.exit(1);
  }

  const logDir = path.join(sprintDir, "runs");
  fs.mkdirSync(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `${stamp}-${args.phase}.log`);

  const verbose = isVerboseStream();
  console.log(`Starting ${sprintFolderName} / ${args.phase} (model: ${args.model})`);
  console.log(`Logging to ${logPath}`);
  if (verbose) {
    console.log("Verbose stream: tool calls, shell output, steps (PERF_SPRINT_VERBOSE=0 to disable)\n");
  }

  const log = fs.createWriteStream(logPath, { flags: "a" });
  const inactivity =
    SPRINT_INACTIVITY_TIMEOUT_MS > 0
      ? createInactivityGuard({
          timeoutMs: SPRINT_INACTIVITY_TIMEOUT_MS,
          onStale: (ms) => {
            const msg = `\n[watchdog] No SDK stream activity for ${ms}ms — aborting sprint\n`;
            process.stderr.write(msg);
            log.write(msg);
            process.exit(3);
          },
        })
      : null;
  const touchActivity = () => inactivity?.touch();
  const write = (line) => {
    touchActivity();
    process.stdout.write(line);
    log.write(line);
  };

  let agent;
  let exitCode = 0;
  try {
    await withTimeout(
      (async () => {
        agent = await Agent.create({
          apiKey: process.env.CURSOR_API_KEY,
          model: { id: args.model },
          local: { cwd: REPO_ROOT, settingSources: [] },
        });

        const sendOptions = verbose
          ? {
              onDelta: ({ update }) => {
                const line = formatDelta(update);
                if (line) write(line);
              },
              onStep: (args) => {
                const line = formatStep(args);
                if (line) write(line);
              },
            }
          : {};

        const run = await agent.send(prompt, sendOptions);
        write(`\n[run.id] ${run.id}\n[agent.id] ${agent.agentId}\n\n`);

        const stopStatusListener = run.onDidChangeStatus?.((status) => {
          write(`\n[run.status] ${status}\n`);
        });

        for await (const event of run.stream()) {
          touchActivity();
          if (verbose) {
            const line = formatStreamEvent(event);
            if (line) write(line);
          } else if (event.type === "assistant") {
            for (const block of event.message.content) {
              if (block.type === "text") write(block.text);
            }
          }
        }

        stopStatusListener?.();

        const result = await run.wait();
        write(`\n\n---\nstatus: ${result.status}\n`);

        if (result.status === "error") {
          exitCode = 2;
          console.error("Run finished with error status. See log and outcomes.md.");
        } else {
          console.log(`Done. Check ${path.join(sprintDir, "outcomes.md")}`);
        }
      })(),
      SPRINT_MAX_TIMEOUT_MS,
      "Sprint run",
    );
  } catch (err) {
    const msg = err?.message ?? String(err);
    if (msg.includes("timed out")) {
      write(`\n[watchdog] ${msg}\n`);
      exitCode = 3;
    } else {
      console.error("Startup or SDK error:", msg);
      exitCode = 1;
    }
  } finally {
    inactivity?.stop();
    try {
      await withTimeout(disposeAgent(agent), SPRINT_DISPOSE_TIMEOUT_MS, "Agent dispose");
    } catch (err) {
      const msg = `\n[watchdog] ${err?.message ?? err} — forcing exit (SDK work may be complete)\n`;
      process.stderr.write(msg);
      log.write(msg);
    }
    log.end();
  }
  // Always exit explicitly — SDK/agent handles can keep the event loop alive after success.
  process.exit(exitCode);
}

main();
