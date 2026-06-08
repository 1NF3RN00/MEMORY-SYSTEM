import { z } from "zod";

const retrievalBm25EnvSchema = z.object({
  /**
   * Sprint 37 — parallel BM25 lexical channel (V2 spike).
   * Default off; when true, runs shadow lexical search in parallel with vector retrieval.
   * Does not alter V1 ranking or context package chunk selection.
   */
  RETRIEVAL_PARALLEL_BM25_V2_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type RetrievalBm25Env = z.infer<typeof retrievalBm25EnvSchema>;

export function loadRetrievalBm25Env(): RetrievalBm25Env {
  const parsed = retrievalBm25EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid retrieval BM25 configuration: ${JSON.stringify(details)}`);
  }
  return parsed.data;
}
