import type { EventEmitter } from "@memory-middleware/observability";
import type { Instruction } from "@memory-middleware/shared-types";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type {
  CreateInstructionInput,
  DomainEngineStore,
  VersionInstructionInput,
} from "./store.js";

export interface InstructionEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

export async function createInstruction(
  deps: InstructionEngineDeps,
  input: CreateInstructionInput,
): Promise<Instruction> {
  assertDomainSlug(input.actionKey, "actionKey");
  const domain = await deps.store.getDomainById(input.domainId);
  if (!domain || domain.workspaceId !== input.workspaceId) {
    throw new DomainEngineError(`Domain not found: ${input.domainId}`, "not_found");
  }
  const existing = await deps.store.getActiveInstruction(input.domainId, input.actionKey);
  if (existing) {
    throw new DomainEngineError(
      `Active instruction already exists for actionKey: ${input.actionKey}`,
      "conflict",
    );
  }
  const instruction = await deps.store.createInstruction(input);
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.INSTRUCTION_CREATED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: {
      instructionId: instruction.instructionId,
      domainId: input.domainId,
      actionKey: input.actionKey,
    },
  });
  return instruction;
}

export async function updateInstruction(
  deps: InstructionEngineDeps,
  domainId: string,
  actionKey: string,
  input: VersionInstructionInput,
): Promise<Instruction> {
  return versionInstruction(deps, domainId, actionKey, input);
}

export async function versionInstruction(
  deps: InstructionEngineDeps,
  domainId: string,
  actionKey: string,
  input: VersionInstructionInput,
): Promise<Instruction> {
  assertDomainSlug(actionKey, "actionKey");
  const domain = await deps.store.getDomainById(domainId);
  if (!domain) {
    throw new DomainEngineError(`Domain not found: ${domainId}`, "not_found");
  }
  const instruction = await deps.store.versionInstruction(domainId, actionKey, input);
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.INSTRUCTION_VERSIONED, {
    traceId: deps.traceId,
    workspaceId: domain.workspaceId,
    extra: {
      instructionId: instruction.instructionId,
      domainId,
      actionKey,
      version: instruction.version,
    },
  });
  return instruction;
}

export async function archiveInstruction(
  deps: InstructionEngineDeps,
  instructionId: string,
): Promise<Instruction> {
  const instruction = await deps.store.archiveInstruction(instructionId);
  if (!instruction) {
    throw new DomainEngineError(`Instruction not found: ${instructionId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.INSTRUCTION_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId: instruction.workspaceId,
    extra: {
      instructionId: instruction.instructionId,
      domainId: instruction.domainId,
      actionKey: instruction.actionKey,
    },
  });
  return instruction;
}
