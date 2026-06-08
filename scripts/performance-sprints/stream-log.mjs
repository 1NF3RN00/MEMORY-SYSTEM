/**
 * Format Cursor SDK stream events for terminal visibility during perf sprints.
 * @see https://cursor.com/docs/sdk/typescript#streaming
 */

const MAX_LINE = 240;
const MAX_TOOL_SUMMARY = 400;

export function isVerboseStream() {
  const raw = process.env.PERF_SPRINT_VERBOSE;
  if (raw === undefined || raw === "") return true;
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

function truncate(text, max = MAX_LINE) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function summarizeUnknown(value) {
  if (value == null) return "";
  if (typeof value === "string") return truncate(value, MAX_TOOL_SUMMARY);
  try {
    return truncate(JSON.stringify(value), MAX_TOOL_SUMMARY);
  } catch {
    return truncate(String(value), MAX_TOOL_SUMMARY);
  }
}

function toolArgsHint(args) {
  if (!args || typeof args !== "object") return "";
  const a = /** @type {Record<string, unknown>} */ (args);
  const cmd = a.command ?? a.cmd;
  if (typeof cmd === "string") return truncate(cmd, MAX_LINE);
  const path = a.path ?? a.file ?? a.target;
  if (typeof path === "string") return truncate(path, MAX_LINE);
  return summarizeUnknown(args);
}

/** Normalized SDKMessage from run.stream() */
export function formatStreamEvent(event) {
  switch (event.type) {
    case "assistant": {
      const lines = [];
      for (const block of event.message?.content ?? []) {
        if (block.type === "text" && block.text) lines.push(block.text);
        if (block.type === "tool_use") {
          const hint = toolArgsHint(block.input);
          lines.push(`\n[tool] ${block.name}${hint ? `: ${hint}` : ""}\n`);
        }
      }
      return lines.join("");
    }
    case "thinking":
      return event.text ? `\n[thinking] ${truncate(event.text, 120)}\n` : null;
    case "tool_call": {
      const hint =
        event.status === "running" || event.status === "error"
          ? toolArgsHint(event.args)
          : summarizeUnknown(event.result);
      const suffix = hint ? ` — ${hint}` : "";
      return `\n[tool] ${event.name} (${event.status})${suffix}\n`;
    }
    case "status":
      return `\n[status] ${event.status}${event.message ? `: ${event.message}` : ""}\n`;
    case "task":
      return event.text ? `\n[task] ${event.text}\n` : null;
    case "system":
      if (event.subtype === "init" && event.tools?.length) {
        return `\n[system] tools: ${event.tools.slice(0, 8).join(", ")}${event.tools.length > 8 ? "…" : ""}\n`;
      }
      return null;
    case "request":
      return `\n[request] awaiting input (${event.request_id})\n`;
    default:
      return null;
  }
}

/** Raw InteractionUpdate from agent.send({ onDelta }) */
export function formatDelta(update) {
  switch (update.type) {
    case "shell-output-delta": {
      const ev = update.event ?? {};
      const chunk =
        ev.stdout ?? ev.stderr ?? ev.output ?? ev.text ?? ev.data ?? ev.chunk;
      return typeof chunk === "string" && chunk.length ? chunk : null;
    }
    case "tool-call-started": {
      const tc = update.toolCall ?? {};
      const name = tc.name ?? tc.toolName ?? tc.type ?? "tool";
      const hint = toolArgsHint(tc.args ?? tc.input);
      return `\n▶ ${name}${hint ? `: ${hint}` : ""}\n`;
    }
    case "tool-call-completed": {
      const tc = update.toolCall ?? {};
      const name = tc.name ?? tc.toolName ?? tc.type ?? "tool";
      return `\n✓ ${name} done\n`;
    }
    case "step-started":
      return `\n[step ${update.stepId}] …\n`;
    case "step-completed":
      return `\n[step ${update.stepId}] ${Math.round((update.stepDurationMs ?? 0) / 1000)}s\n`;
    case "thinking-completed":
      return `\n[thinking] ${Math.round((update.thinkingDurationMs ?? 0) / 1000)}s\n`;
    case "summary":
      return update.summary ? `\n[summary] ${truncate(update.summary, 160)}\n` : null;
    default:
      return null;
  }
}

export function formatStep({ step }) {
  if (!step?.type) return null;
  return `\n[step] ${step.type}\n`;
}
