import { recordLlmCall } from "@memory-middleware/observability";
import type { CompressionStageTrace } from "@memory-middleware/shared-types";
import type { ResolvedCompressionConfig } from "./config.js";
import type { MergedChunk } from "./merge.js";
import { estimateTokens } from "./token-estimator.js";

const ABSTRACTION_MODEL = "gpt-4o-mini";

export interface AbstractionClient {
  summarize(text: string, maxTokens: number): Promise<string>;
}

export interface AbstractionResult {
  chunks: MergedChunk[];
  stageTrace: CompressionStageTrace;
  tokenSavings: number;
  llmUsed: boolean;
}

/**
 * Deterministic sentence extraction first; LLM only when configured and still over budget.
 */
export async function optionalAbstraction(
  chunks: MergedChunk[],
  targetTokens: number,
  config: ResolvedCompressionConfig,
  client: AbstractionClient | null,
): Promise<AbstractionResult> {
  let currentTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  if (currentTokens <= targetTokens || !config.runtime.abstraction.enabled) {
    return {
      chunks,
      tokenSavings: 0,
      llmUsed: false,
      stageTrace: {
        compressionStage: "abstraction",
        affectedChunks: [],
        tokenSavings: 0,
        fidelityImpact: "none",
        compressionReason: config.runtime.abstraction.enabled
          ? "Within token budget — abstraction skipped"
          : "Abstraction disabled by fidelity mode",
        rankingPreservation: true,
        llmUsed: false,
      },
    };
  }

  const maxAbstract = Math.ceil(chunks.length * config.runtime.abstraction.maxAbstractionRatio);
  const sorted = [...chunks].sort((a, b) => {
    if (a.rankingRank !== b.rankingRank) return b.rankingRank - a.rankingRank;
    return b.tokenCount - a.tokenCount;
  });

  const abstracted: MergedChunk[] = [...chunks];
  const affected: string[] = [];
  let tokenSavings = 0;
  let llmUsed = false;
  let abstractCount = 0;

  for (const candidate of sorted) {
    if (currentTokens <= targetTokens || abstractCount >= maxAbstract) break;

    const idx = abstracted.findIndex((c) => c.chunkId === candidate.chunkId);
    if (idx < 0) continue;

    const original = abstracted[idx]!;
    const targetChunkTokens = Math.max(
      32,
      Math.ceil(original.tokenCount * (1 - config.profile.trimAggressiveness * 0.4)),
    );

    let abstractedContent: string;
    let usedLlm = false;

    if (client && original.tokenCount > targetChunkTokens * 1.5) {
      try {
        abstractedContent = await client.summarize(original.content, targetChunkTokens);
        usedLlm = true;
        llmUsed = true;
      } catch {
        abstractedContent = deterministicExtract(original.content, targetChunkTokens);
      }
    } else {
      abstractedContent = deterministicExtract(original.content, targetChunkTokens);
    }

    const newTokenCount = estimateTokens(abstractedContent);
    const savings = Math.max(0, original.tokenCount - newTokenCount);
    if (savings === 0) continue;

    abstracted[idx] = {
      ...original,
      content: abstractedContent,
      tokenCount: newTokenCount,
      mergeReason: usedLlm
        ? "LLM-assisted fidelity-aware abstraction"
        : "Deterministic sentence extraction",
    };

    currentTokens -= savings;
    tokenSavings += savings;
    affected.push(original.chunkId);
    abstractCount += 1;
  }

  return {
    chunks: abstracted.sort((a, b) => a.rankingRank - b.rankingRank),
    tokenSavings,
    llmUsed,
    stageTrace: {
      compressionStage: "abstraction",
      affectedChunks: affected,
      tokenSavings,
      fidelityImpact: llmUsed ? "medium" : affected.length > 0 ? "low" : "none",
      compressionReason:
        affected.length > 0
          ? `Abstracted ${affected.length} chunks${llmUsed ? " (LLM-assisted)" : " (deterministic)"}`
          : "Abstraction not required",
      rankingPreservation: true,
      llmUsed,
      metadata: { abstracted_count: affected.length },
    },
  };
}

function deterministicExtract(content: string, targetTokens: number): string {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const words = content.split(/\s+/);
    const limit = Math.max(8, targetTokens);
    return words.slice(0, limit).join(" ");
  }

  const keep = Math.max(1, Math.ceil(sentences.length * 0.6));
  return sentences.slice(0, keep).join(" ");
}

export function createOpenAiAbstractionClient(apiKey: string): AbstractionClient {
  return {
    async summarize(text: string, maxTokens: number): Promise<string> {
      const started = Date.now();
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ABSTRACTION_MODEL,
          temperature: 0,
          max_tokens: Math.min(maxTokens, 512),
          messages: [
            {
              role: "system",
              content:
                "Summarize the following context preserving operational nuance and source meaning. Do not add new facts.",
            },
            { role: "user", content: text },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI summarization failed: ${response.status} ${body}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      recordLlmCall({
        operation: "compression_abstraction",
        model: ABSTRACTION_MODEL,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
      });

      return data.choices[0]?.message?.content?.trim() ?? text;
    },
  };
}
