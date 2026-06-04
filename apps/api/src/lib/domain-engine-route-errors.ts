import type { FastifyReply } from "fastify";
import { DomainEngineError } from "@memory-middleware/domain-engine";

export function sendDomainEngineError(reply: FastifyReply, error: unknown): void {
  if (error instanceof DomainEngineError) {
    const status =
      error.code === "not_found"
        ? 404
        : error.code === "conflict"
          ? 409
          : error.code === "invalid_request" || error.code === "invalid_slug"
            ? 400
            : 500;
    reply.status(status).send({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  throw error;
}
