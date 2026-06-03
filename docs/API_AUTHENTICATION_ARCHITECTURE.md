# API Authentication Architecture — V1

## Overview

Operational access to contextual middleware infrastructure is **invite-only** and **workspace-scoped**. Authentication is delegated to **Supabase Auth**; authorization and workspace isolation are enforced by the API middleware layer.

## Flow

```txt
Request Access → Admin Approval → Workspace Provisioning → Password Setup Email → Dashboard Login
```

## Components

| Layer | Responsibility |
|-------|----------------|
| Supabase Auth | Sessions, JWT, password reset/setup emails |
| API Auth Middleware | JWT/API key validation, workspace scope injection |
| Prisma | Access requests, memberships, hashed API keys, security events |
| Historian / Event Log | Provisioning and auth observability traces |

## Credentials

- **Dashboard**: Supabase session bearer token
- **Middleware API**: `x-api-key` header (`mw_live_…`), hashed at rest

## Workspace Isolation

Every middleware route resolves `workspaceId` from authenticated context. Client-supplied workspace IDs are validated against membership; mismatches return `403`.

## Platform Events

`access_requested`, `access_approved`, `workspace_created`, `workspace_initialized`, `api_key_created`, `auth_success`, `auth_failure`, `workspace_scope_applied`, and related types are emitted to the append-only event log.
