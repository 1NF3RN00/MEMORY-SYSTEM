import { z } from "zod";

const compressionEnvSchema = z.object({
  API_COMPRESSION_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
  /** Minimum response body size (bytes) before gzip/brotli is applied. */
  API_COMPRESSION_THRESHOLD_BYTES: z.coerce.number().int().nonnegative().default(1024),
});

export type CompressionEnv = z.infer<typeof compressionEnvSchema>;

export function loadCompressionEnv(): CompressionEnv {
  const parsed = compressionEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid response compression configuration: ${JSON.stringify(details)}`);
  }
  return parsed.data;
}
