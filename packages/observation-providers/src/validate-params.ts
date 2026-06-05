import type { ObservationProviderDefinition } from "@memory-middleware/shared-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCollectionParams(
  definition: ObservationProviderDefinition,
  params: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const schema = definition.collectionInputSchema;
  if (!isRecord(schema)) return errors;

  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const field of required) {
    if (typeof field !== "string") continue;
    const value = params[field];
    if (value === undefined || value === null || value === "") {
      errors.push(`params.${field} is required`);
    }
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  for (const [key, value] of Object.entries(params)) {
    const propSchema = properties[key];
    if (!isRecord(propSchema)) continue;

    if (propSchema.type === "string" && typeof value !== "string") {
      errors.push(`params.${key} must be a string`);
    }
    if (propSchema.type === "number" && typeof value !== "number") {
      errors.push(`params.${key} must be a number`);
    }
    if (propSchema.type === "array" && !Array.isArray(value)) {
      errors.push(`params.${key} must be an array`);
    }
    if (propSchema.enum && Array.isArray(propSchema.enum) && !propSchema.enum.includes(value)) {
      errors.push(`params.${key} must be one of: ${propSchema.enum.join(", ")}`);
    }
  }

  return errors;
}
