/** Platform access & workspace provisioning contracts (V1). */

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export interface AccessRequest {
  requestId: string;
  email: string;
  company?: string;
  useCase?: string;
  note?: string;
  status: AccessRequestStatus;
  createdAt: string;
  reviewedAt?: string;
}

export type WorkspacePlan = "internal" | "alpha" | "production";

export interface WorkspaceRecord {
  workspaceId: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  plan: WorkspacePlan;
  archived: boolean;
}

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMembership {
  membershipId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export type ApiKeyPermission =
  | "ingest"
  | "retrieve"
  | "replay"
  | "diagnostics"
  | "relationships"
  | "admin";

export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  name: string;
  permissions: ApiKeyPermission[];
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export interface WorkspaceBootstrapStatus {
  replayInitialized: boolean;
  diagnosticsInitialized: boolean;
  relationshipsInitialized: boolean;
  observabilityOnline: boolean;
  retrievalCalibrated: boolean;
  contextualMappingInitialized: boolean;
  initializedAt?: string;
}

export const PLATFORM_EVENT_TYPES = {
  ACCESS_REQUESTED: "access_requested",
  ACCESS_APPROVED: "access_approved",
  ACCESS_REJECTED: "access_rejected",
  WORKSPACE_CREATED: "workspace_created",
  WORKSPACE_INITIALIZED: "workspace_initialized",
  MEMBERSHIP_CREATED: "membership_created",
  API_KEY_CREATED: "api_key_created",
  API_KEY_REVOKED: "api_key_revoked",
  AUTH_SUCCESS: "auth_success",
  AUTH_FAILURE: "auth_failure",
  WORKSPACE_SCOPE_APPLIED: "workspace_scope_applied",
  PROVISIONING_FAILED: "provisioning_failed",
} as const;

export type PlatformEventType =
  (typeof PLATFORM_EVENT_TYPES)[keyof typeof PLATFORM_EVENT_TYPES];

export const DEFAULT_API_KEY_PERMISSIONS: ApiKeyPermission[] = [
  "ingest",
  "retrieve",
  "replay",
  "diagnostics",
  "relationships",
];
