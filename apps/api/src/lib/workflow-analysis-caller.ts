import { recordLlmCall } from "@memory-middleware/observability";
import type { StructuredJsonCaller } from "@memory-middleware/domain-engine";

export function createOpenAiStructuredJsonCaller(apiKey: string): StructuredJsonCaller {
  return {
    async callStructuredJson(input) {
      const started = Date.now();
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.modelId,
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "workflow_analysis_output",
              strict: true,
              schema: input.jsonSchema,
            },
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI structured analysis failed: ${response.status} ${body}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      recordLlmCall({
        operation: "workflow_analysis",
        model: input.modelId,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
      });

      const content = data.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("OpenAI structured analysis returned empty content");
      }

      return JSON.parse(content) as unknown;
    },
  };
}
