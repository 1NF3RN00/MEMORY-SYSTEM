import type {
  ContextGroupingDecision,
  ContextPackageInput,
  ContextRenderRelationshipHint,
  DeliveryMode,
  RetrievedMemory,
} from "@memory-middleware/shared-types";
import { getDeliveryModeProfile } from "./config.js";

export interface ContextGroup {
  groupId: string;
  groupLabel: string;
  groupingReason: ContextGroupingDecision["groupingReason"];
  memories: RetrievedMemory[];
}

function normalizeTopic(title: string): string {
  const cleaned = title
    .replace(/^(section|chapter|part)\s+\d+[:\-.]?\s*/i, "")
    .split(/[:\-|]/)[0]
    ?.trim()
    .toLowerCase();
  return cleaned && cleaned.length > 0 ? cleaned : "general";
}

function domainLabel(memoryType: string): string {
  return memoryType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function applyRelationshipAdjacency(
  memories: RetrievedMemory[],
  hints: ContextRenderRelationshipHint[] | undefined,
): RetrievedMemory[] {
  if (!hints || hints.length === 0) return memories;

  const byId = new Map(memories.map((m) => [m.memoryId, m]));
  const ordered: RetrievedMemory[] = [];
  const seen = new Set<string>();

  const sortedHints = [...hints].sort((a, b) => b.weight - a.weight);
  for (const hint of sortedHints) {
    for (const id of [hint.sourceMemoryId, hint.targetMemoryId]) {
      const memory = byId.get(id);
      if (memory && !seen.has(id)) {
        ordered.push(memory);
        seen.add(id);
      }
    }
  }

  for (const memory of memories) {
    if (!seen.has(memory.memoryId)) {
      ordered.push(memory);
      seen.add(memory.memoryId);
    }
  }

  return ordered;
}

export function groupContext(
  pkg: ContextPackageInput,
  mode: DeliveryMode,
  relationshipHints?: ContextRenderRelationshipHint[],
): { groups: ContextGroup[]; decisions: ContextGroupingDecision[] } {
  const profile = getDeliveryModeProfile(mode);
  const orderedMemories = applyRelationshipAdjacency(pkg.memories, relationshipHints);

  if (profile.useDomainLabels) {
    const byDomain = new Map<string, RetrievedMemory[]>();
    for (const memory of orderedMemories) {
      const key = memory.memoryType;
      const list = byDomain.get(key) ?? [];
      list.push(memory);
      byDomain.set(key, list);
    }

    const groups: ContextGroup[] = [];
    const decisions: ContextGroupingDecision[] = [];

    for (const [memoryType, memories] of [...byDomain.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const groupId = `domain-${memoryType}`;
      groups.push({
        groupId,
        groupLabel: domainLabel(memoryType),
        groupingReason: "operational_domain",
        memories,
      });
      decisions.push({
        groupId,
        groupLabel: domainLabel(memoryType),
        groupingReason: "operational_domain",
        memoryIds: memories.map((m) => m.memoryId),
        chunkIds: memories.flatMap((m) => m.chunks.map((c) => c.chunkId)),
      });
    }

    return { groups, decisions };
  }

  const byTopic = new Map<string, RetrievedMemory[]>();
  for (const memory of orderedMemories) {
    const topic = normalizeTopic(memory.title);
    const list = byTopic.get(topic) ?? [];
    list.push(memory);
    byTopic.set(topic, list);
  }

  const groups: ContextGroup[] = [];
  const decisions: ContextGroupingDecision[] = [];

  for (const [topic, memories] of [...byTopic.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const label =
      topic === "general"
        ? "Context"
        : topic.replace(/\b\w/g, (c) => c.toUpperCase());
    const groupId = `topic-${topic.replace(/\s+/g, "-")}`;
    const reason: ContextGroupingDecision["groupingReason"] =
      byTopic.size === 1 && memories.length > 1 ? "semantic_similarity" : "topic";

    groups.push({
      groupId,
      groupLabel: label,
      groupingReason: reason,
      memories,
    });
    decisions.push({
      groupId,
      groupLabel: label,
      groupingReason: reason,
      memoryIds: memories.map((m) => m.memoryId),
      chunkIds: memories.flatMap((m) => m.chunks.map((c) => c.chunkId)),
    });
  }

  return { groups, decisions };
}
