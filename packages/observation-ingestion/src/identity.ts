import type { Observation, ObservationMetadata } from "@memory-middleware/shared-types";

export interface ObservationIdentity {
  workspaceId: string;
  provider: string;
  metric: string;
  businessId?: string;
  competitorId?: string;
}

export function observationIdentityFromMetadata(
  workspaceId: string,
  metadata: ObservationMetadata,
): ObservationIdentity {
  const identity: ObservationIdentity = {
    workspaceId,
    provider: metadata.provider,
    metric: metadata.metric,
  };
  if (metadata.businessId) identity.businessId = metadata.businessId;
  if (metadata.competitorId) identity.competitorId = metadata.competitorId;
  return identity;
}

export function observationIdentity(observation: Observation): ObservationIdentity {
  return observationIdentityFromMetadata(observation.workspaceId, observation.metadata);
}

export function observationIdentityKey(identity: ObservationIdentity): string {
  return [
    identity.workspaceId,
    identity.businessId ?? "",
    identity.competitorId ?? "",
    identity.provider,
    identity.metric,
  ].join("|");
}

export function matchesObservationIdentity(
  metadata: ObservationMetadata,
  workspaceId: string,
  identity: ObservationIdentity,
): boolean {
  if (metadata.provider !== identity.provider || metadata.metric !== identity.metric) {
    return false;
  }
  if ((metadata.businessId ?? "") !== (identity.businessId ?? "")) return false;
  if ((metadata.competitorId ?? "") !== (identity.competitorId ?? "")) return false;
  return workspaceId === identity.workspaceId;
}
