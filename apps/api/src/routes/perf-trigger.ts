import type { FastifyInstance } from "fastify";
import { collectSprintLogHealth, getLatestSprintActivity } from "../lib/sprint-staleness.js";
import {
  getWaveRunState,
  listWaveRuns,
  startPerfWave,
  verifyWaveToken,
} from "../lib/perf-wave-runner.js";

function triggerSecret(): string | undefined {
  const secret = process.env.PERF_TRIGGER_SECRET?.trim();
  return secret || undefined;
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.5}
.ok{color:#166534}.err{color:#991b1b}code{background:#f4f4f5;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>${title}</h1>${body}</body></html>`;
}

export async function registerPerfTriggerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { wave?: string; token?: string } }>(
    "/perf/trigger",
    async (request, reply) => {
      const secret = triggerSecret();
      if (!secret) {
        return reply.status(503).send({
          error: "PERF_TRIGGER_SECRET not configured",
        });
      }

      const wave = Number(request.query.wave);
      const token = request.query.token?.trim() ?? "";

      if (!Number.isInteger(wave) || wave < 1 || wave > 7) {
        return reply.status(400).send({ error: "wave must be 1-7" });
      }

      if (!verifyWaveToken(wave, token, secret)) {
        return reply
          .status(403)
          .type("text/html")
          .send(htmlPage("Unauthorized", `<p class="err">Invalid or expired trigger token.</p>`));
      }

      const state = startPerfWave(wave);

      return reply.type("text/html").send(
        htmlPage(
          `Wave ${wave} started`,
          `<p class="ok">Performance wave <strong>${wave}</strong> is running on this machine.</p>
           <p>PID: <code>${state.pid ?? "—"}</code></p>
           <p>Log: <code>${state.logPath}</code></p>
           <p>You will receive email at <code>${process.env.PERF_NOTIFY_EMAIL ?? "PERF_NOTIFY_EMAIL"}</code> when it completes.</p>
           <p><a href="/perf/status?wave=${wave}&token=${token}">Check status</a></p>`,
        ),
      );
    },
  );

  app.get<{ Querystring: { wave?: string; token?: string } }>(
    "/perf/status",
    async (request, reply) => {
      const secret = triggerSecret();
      if (!secret) {
        return reply.status(503).send({ error: "PERF_TRIGGER_SECRET not configured" });
      }

      const wave = Number(request.query.wave);
      const token = request.query.token?.trim() ?? "";

      if (!Number.isInteger(wave) || wave < 1 || wave > 7) {
        return reply.status(400).send({ error: "wave must be 1-7" });
      }

      if (!verifyWaveToken(wave, token, secret)) {
        return reply.status(403).send({ error: "invalid token" });
      }

      const state = getWaveRunState(wave);
      const latest = getLatestSprintActivity();
      return {
        wave,
        state: state ?? null,
        allRuns: listWaveRuns(),
        latestSprint: latest,
        stale: latest?.stale ?? false,
      };
    },
  );

  app.get<{ Querystring: { wave?: string; token?: string } }>(
    "/perf/dashboard",
    async (request, reply) => {
    const secret = triggerSecret();
    if (!secret) {
      return reply.status(503).send({ error: "PERF_TRIGGER_SECRET not configured" });
    }

    const wave = Number(request.query.wave ?? 1);
    const token = request.query.token?.trim() ?? "";
    if (!Number.isInteger(wave) || wave < 1 || wave > 7 || !verifyWaveToken(wave, token, secret)) {
      return reply.status(403).send({ error: "invalid token" });
    }

    const sprintLogs = collectSprintLogHealth();
    const latest = sprintLogs[0] ?? null;
    return {
      generatedAt: new Date().toISOString(),
      waves: listWaveRuns(),
      sprintLogs: sprintLogs.slice(0, 8),
      latestSprint: latest,
      stale: latest?.stale ?? false,
      controls: {
        triggerWave: "/perf/trigger?wave={n}&token={token}",
        status: "/perf/status?wave={n}&token={token}",
        dashboard: "/perf/dashboard?wave={n}&token={token}",
      },
    };
    },
  );
}
