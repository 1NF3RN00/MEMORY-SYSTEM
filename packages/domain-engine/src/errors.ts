export class DomainEngineError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainEngineError";
  }
}

export function assertDomainSlug(value: string, label: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new DomainEngineError(
      `${label} must be a lowercase slug (^[a-z][a-z0-9-]*$)`,
      "invalid_slug",
    );
  }
}
