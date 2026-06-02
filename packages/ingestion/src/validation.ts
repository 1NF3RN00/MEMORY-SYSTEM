import type { IngestRequestBody, SourceType } from "@memory-middleware/shared-types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateIngestRequest(body: IngestRequestBody): ValidationResult {
  const errors: string[] = [];

  if (!body.workspaceId?.trim()) {
    errors.push("workspaceId is required");
  }

  const sourceTypes: SourceType[] = ["website", "markdown", "json", "text"];
  if (!sourceTypes.includes(body.sourceType)) {
    errors.push(`sourceType must be one of: ${sourceTypes.join(", ")}`);
  }

  if (body.sourceType === "website") {
    if (!body.url?.trim() && !body.sourceUrl?.trim()) {
      errors.push("url or sourceUrl is required for website ingestion");
    }
  } else if (!body.content?.trim()) {
    errors.push("content is required for non-website sources");
  }

  if (body.persistenceMode && !["persistent", "temporary"].includes(body.persistenceMode)) {
    errors.push("persistenceMode must be persistent or temporary");
  }

  return { valid: errors.length === 0, errors };
}
