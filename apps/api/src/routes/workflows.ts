import type { FastifyInstance } from "fastify";
import {
  archiveWorkflow,
  archiveWorkflowRun,
  createWorkflow,
  deleteWorkflow,
  executeWorkflow,
  resolveWorkflowExecutionContext,
  updateWorkflow,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
} from "@memory-middleware/domain-engine";
import { newUlid, type WorkflowInstructionRef } from "@memory-middleware/shared-types";
import { createPrismaDomainEngineStore } from "../lib/domain-engine/index.js";
import { sendDomainEngineError } from "../lib/domain-engine-route-errors.js";
import { captureWorkflowRunReplaySnapshot, getWorkflowRunReplaySnapshot } from "../lib/workflow-replay-store.js";
import {
  retrieveForWorkflowDomain,
  retrieveObservationsForWorkflowScope,
} from "../lib/workflow-retrieval.js";
import { createOpenAiStructuredJsonCaller } from "../lib/workflow-analysis-caller.js";
import { loadEnv } from "../config/env.js";
import { enforceWorkspaceScope } from "../middleware/auth.js";
import { enforceOperationalPermission } from "../middleware/operational-rbac.js";

function engineDeps(app: FastifyInstance, traceId: string) {
  return {
    store: createPrismaDomainEngineStore(app.prisma),
    events: app.events,
    traceId,
  };
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function parseInstructionRefs(value: unknown): WorkflowInstructionRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs: WorkflowInstructionRef[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      if (typeof obj.domainKey === "string" && typeof obj.actionKey === "string") {
        refs.push({ domainKey: obj.domainKey, actionKey: obj.actionKey });
      }
    }
  }
  return refs;
}

function buildCreateWorkflowInput(
  workspaceId: string,
  name: string,
  body: Record<string, unknown> | null,
) {
  const input: CreateWorkflowInput = {
    workspaceId,
    name,
  };
  if (typeof body?.description === "string") input.description = body.description;
  if (typeof body?.workflowKey === "string" && body.workflowKey.trim()) {
    input.workflowKey = body.workflowKey.trim();
  }
  if (typeof body?.analysisSpecKey === "string" && body.analysisSpecKey.trim()) {
    input.analysisSpecKey = body.analysisSpecKey.trim();
  }
  const domains = parseStringArray(body?.domains);
  if (domains) input.domains = domains;
  const packages = parseStringArray(body?.packages);
  if (packages) input.packages = packages;
  const instructionRefs = parseInstructionRefs(body?.instructionRefs);
  if (instructionRefs) input.instructionRefs = instructionRefs;
  const outputTypes = parseStringArray(body?.outputTypes);
  if (outputTypes) input.outputTypes = outputTypes;
  const objectTypeFilters = parseStringArray(body?.objectTypeFilters);
  if (objectTypeFilters) input.objectTypeFilters = objectTypeFilters;
  return input;
}

function buildUpdateWorkflowInput(body: Record<string, unknown> | null) {
  const input: UpdateWorkflowInput = {};
  if (typeof body?.name === "string") input.name = body.name;
  if (typeof body?.description === "string") input.description = body.description;
  if (typeof body?.workflowKey === "string") input.workflowKey = body.workflowKey;
  if (typeof body?.analysisSpecKey === "string") input.analysisSpecKey = body.analysisSpecKey;
  const domains = parseStringArray(body?.domains);
  if (domains) input.domains = domains;
  const packages = parseStringArray(body?.packages);
  if (packages) input.packages = packages;
  const instructionRefs = parseInstructionRefs(body?.instructionRefs);
  if (instructionRefs) input.instructionRefs = instructionRefs;
  const outputTypes = parseStringArray(body?.outputTypes);
  if (outputTypes) input.outputTypes = outputTypes;
  const objectTypeFilters = parseStringArray(body?.objectTypeFilters);
  if (objectTypeFilters) input.objectTypeFilters = objectTypeFilters;
  if (typeof body?.active === "boolean") input.active = body.active;
  return input;
}

export async function registerWorkflowRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { workspaceId: string; includeArchived?: string } }>(
    "/workflows",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const includeArchived = request.query.includeArchived === "true";
      const workflows = await store.listWorkflows(workspaceId, includeArchived);
      return { workspaceId, workflows };
    },
  );

  app.get<{ Params: { workflowId: string }; Querystring: { workspaceId: string } }>(
    "/workflows/:workflowId",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const workflow = await store.getWorkflow(request.params.workflowId);
      if (!workflow || workflow.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Workflow not found" });
      }
      return { workflow };
    },
  );

  app.get<{
    Params: { workflowId: string };
    Querystring: { workspaceId: string; previousRunLimit?: string };
  }>("/workflows/:workflowId/execution-context", async (request, reply) => {
    const { workspaceId, previousRunLimit } = request.query;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const workflow = await store.getWorkflow(request.params.workflowId);
    if (!workflow || workflow.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Workflow not found" });
    }

    try {
      const parsedLimit = previousRunLimit ? Number(previousRunLimit) : undefined;
      const resolveInput: {
        workspaceId: string;
        workflowId: string;
        previousRunLimit?: number;
      } = {
        workspaceId,
        workflowId: request.params.workflowId,
      };
      if (Number.isFinite(parsedLimit)) {
        resolveInput.previousRunLimit = parsedLimit as number;
      }

      const executionContext = await resolveWorkflowExecutionContext(
        engineDeps(app, newUlid()),
        resolveInput,
      );
      return { executionContext };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post("/workflows", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    try {
      if (typeof body?.name !== "string" || !body.name.trim()) {
        return reply.status(400).send({ error: "name is required" });
      }
      const workflow = await createWorkflow(
        engineDeps(app, newUlid()),
        buildCreateWorkflowInput(workspaceId, body.name.trim(), body),
      );
      return { workflow };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.patch<{ Params: { workflowId: string } }>("/workflows/:workflowId", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const existing = await store.getWorkflow(request.params.workflowId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Workflow not found" });
    }

    try {
      const workflow = await updateWorkflow(
        engineDeps(app, newUlid()),
        request.params.workflowId,
        buildUpdateWorkflowInput(body),
      );
      return { workflow };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post<{ Params: { workflowId: string } }>(
    "/workflows/:workflowId/archive",
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;
      const workspaceId = body?.workspaceId;
      if (typeof workspaceId !== "string" || !workspaceId) {
        return reply.status(400).send({ error: "workspaceId is required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const existing = await store.getWorkflow(request.params.workflowId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Workflow not found" });
      }

      try {
        const workflow = await archiveWorkflow(engineDeps(app, newUlid()), request.params.workflowId);
        return { workflow };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.delete<{ Params: { workflowId: string } }>(
    "/workflows/:workflowId",
    async (request, reply) => {
      const workspaceId = (request.query as Record<string, string>).workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "hard_delete", { workspaceId }))) {
        return;
      }

      const store = createPrismaDomainEngineStore(app.prisma);
      const existing = await store.getWorkflow(request.params.workflowId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Workflow not found" });
      }

      try {
        await deleteWorkflow(engineDeps(app, newUlid()), request.params.workflowId);
        return { deleted: true };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.post<{ Params: { workflowId: string } }>(
    "/workflows/:workflowId/execute",
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;
      const workspaceId = body?.workspaceId;
      if (typeof workspaceId !== "string" || !workspaceId) {
        return reply.status(400).send({ error: "workspaceId is required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const query = body?.query;
      if (typeof query !== "string" || !query.trim()) {
        return reply.status(400).send({ error: "query is required" });
      }

      const tokenBudget = body?.tokenBudget;
      const previousRunLimit = body?.previousRunLimit;
      const executeInput: {
        workspaceId: string;
        workflowId: string;
        query: string;
        tokenBudget?: number;
        previousRunLimit?: number;
      } = {
        workspaceId,
        workflowId: request.params.workflowId,
        query: query.trim(),
      };
      if (typeof tokenBudget === "number" && tokenBudget > 0) {
        executeInput.tokenBudget = tokenBudget;
      }
      if (typeof previousRunLimit === "number" && previousRunLimit > 0) {
        executeInput.previousRunLimit = previousRunLimit;
      }

      try {
        const env = loadEnv();
        const analysisEnabled =
          env.WORKFLOW_ANALYSIS_ENABLED !== false && Boolean(env.WORKFLOW_ANALYSIS_MODEL);
        const detail = await executeWorkflow(engineDeps(app, newUlid()), executeInput, {
          retrieve: {
            retrieveForDomain: (input) => retrieveForWorkflowDomain(app, input),
          },
          observations: {
            retrieveObservations: (scope) => retrieveObservationsForWorkflowScope(app, scope),
          },
          ...(analysisEnabled && env.OPENAI_API_KEY && env.WORKFLOW_ANALYSIS_MODEL
            ? {
                analysis: {
                  caller: createOpenAiStructuredJsonCaller(env.OPENAI_API_KEY),
                  modelId: env.WORKFLOW_ANALYSIS_MODEL,
                },
              }
            : {}),
        });
        await captureWorkflowRunReplaySnapshot(app.prisma, detail, query.trim());
        return {
          workflowRunId: detail.workflowRunId,
          status: detail.status,
          outputs: detail.outputs,
          generatedFactIds: detail.generatedFactIds,
          generatedMemoryIds: detail.generatedMemoryIds,
          generatedObjectIds: detail.generatedObjectIds,
          executionContext: detail.executionContext,
        };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.get<{
    Params: { workflowId: string };
    Querystring: { workspaceId: string; limit?: string };
  }>("/workflows/:workflowId/runs", async (request, reply) => {
    const { workspaceId, limit } = request.query;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const workflow = await store.getWorkflow(request.params.workflowId);
    if (!workflow || workflow.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Workflow not found" });
    }

    const parsedLimit = limit ? Number(limit) : 50;
    const runs = await store.listWorkflowRuns(
      request.params.workflowId,
      workspaceId,
      Number.isFinite(parsedLimit) ? parsedLimit : 50,
    );
    return { workflowId: request.params.workflowId, runs };
  });

  app.get<{ Params: { workflowRunId: string }; Querystring: { workspaceId: string } }>(
    "/workflow-runs/:workflowRunId",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const detail = await store.getWorkflowRunDetail(request.params.workflowRunId);
      if (!detail || detail.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Workflow run not found" });
      }
      return { run: detail };
    },
  );

  app.get<{ Params: { workflowRunId: string }; Querystring: { workspaceId: string } }>(
    "/workflow-runs/:workflowRunId/replay",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const detail = await store.getWorkflowRunDetail(request.params.workflowRunId);
      if (!detail || detail.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Workflow run not found" });
      }

      const snapshot = await getWorkflowRunReplaySnapshot(app.prisma, request.params.workflowRunId);
      if (snapshot) {
        return { replay: snapshot };
      }

      const queryFromOutput =
        typeof detail.outputs[0]?.data?.query === "string"
          ? String(detail.outputs[0]?.data?.query)
          : "workflow-run";
      const created = await captureWorkflowRunReplaySnapshot(
        app.prisma,
        detail,
        queryFromOutput,
      );
      return { replay: created };
    },
  );

  app.post<{ Params: { workflowRunId: string } }>(
    "/workflow-runs/:workflowRunId/archive",
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;
      const workspaceId = body?.workspaceId;
      if (typeof workspaceId !== "string" || !workspaceId) {
        return reply.status(400).send({ error: "workspaceId is required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const existing = await store.getWorkflowRun(request.params.workflowRunId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Workflow run not found" });
      }

      try {
        const run = await archiveWorkflowRun(
          engineDeps(app, newUlid()),
          request.params.workflowRunId,
        );
        return { run };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );
}
