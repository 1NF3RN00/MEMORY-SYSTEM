import { applyFactOverridesToMemories } from "@memory-middleware/domain-engine";
import type { ChunkMetadataLookup } from "@memory-middleware/domain-engine";
import type {
  ContextPackageInput,
  DomainContextMetadata,
  DomainExecutionContext,
  RenderedSection,
} from "@memory-middleware/shared-types";

export interface PrepareContextPackageInput {
  contextPackage: ContextPackageInput;
  executionContext: DomainExecutionContext;
  metadataByChunkId?: Map<string, ChunkMetadataLookup>;
}

export interface PrepareContextPackageResult {
  contextPackage: ContextPackageInput;
  domainMetadata: DomainContextMetadata;
  instructionSections: RenderedSection[];
}

export function buildInstructionSections(
  executionContext: DomainExecutionContext,
): RenderedSection[] {
  return executionContext.instructions
    .filter((i) => i.status === "active" && i.isActive)
    .map((instruction) => ({
      title: instruction.title,
      content: instruction.content,
      sourceMemoryIds: [],
    }));
}

/**
 * Applies fact precedence to retrieved memories and attaches admin-visible override trace.
 * Idempotent when domainMetadata is already present on the package.
 */
export function prepareContextPackageForDelivery(
  input: PrepareContextPackageInput,
): PrepareContextPackageResult {
  if (input.contextPackage.domainMetadata) {
    return {
      contextPackage: input.contextPackage,
      domainMetadata: input.contextPackage.domainMetadata,
      instructionSections: buildInstructionSections(
        input.contextPackage.domainMetadata.executionContext ?? input.executionContext,
      ),
    };
  }

  const { memories, overrides } = applyFactOverridesToMemories({
    memories: input.contextPackage.memories,
    context: input.executionContext,
    ...(input.metadataByChunkId ? { metadataByChunkId: input.metadataByChunkId } : {}),
  });

  const domainMetadata: DomainContextMetadata = {
    executionContext: input.executionContext,
    factOverrides: overrides,
  };

  const contextPackage: ContextPackageInput = {
    ...input.contextPackage,
    memories,
    domainMetadata,
  };

  return {
    contextPackage,
    domainMetadata,
    instructionSections: buildInstructionSections(input.executionContext),
  };
}
