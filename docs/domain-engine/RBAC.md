# Domain Engine — RBAC

Workspace-wide permissions only. No per-domain ACLs.

---

## Role resolution

Priority order when building `AuthContext.operationalRole`:

1. `PlatformUser.isMiddlewareAdmin` OR legacy `isPlatformAdmin` → `middleware_admin`
2. Else `PlatformUser.agencyId` set → `agency_admin` (scoped to that agency)
3. Else `PlatformUser.platformId` set → `platform_admin` (scoped to that platform)
4. Else `WorkspaceMembership.operationalRole` if set
5. Else map `membership.role`: `owner`|`admin` → `workspace_admin`, `member` → `workspace_user`

API keys inherit workspace scope only — they do **not** receive `middleware_admin`. Keys use `WorkspaceUser`-level capabilities from `permissions` JSON.

---

## Permission matrix

| Action | middleware_admin | agency_admin | platform_admin | workspace_admin | workspace_user |
|--------|:----------------:|:------------:|:--------------:|:---------------:|:--------------:|
| Manage package catalog (`PackageDefinition`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Install / export / update package in workspace | ✅ | ❌ | ❌ | ✅ | ❌ |
| Clone package to another workspace | ✅ | ✅* | ✅* | ❌ | ❌ |
| Create / update / archive domain | ✅ | ❌ | ❌ | ✅ | ❌ |
| Hard delete domain / fact | ✅ | ❌ | ❌ | ❌ | ❌ |
| CRUD global facts | ✅ | ❌ | ❌ | ✅ | ❌ |
| CRUD domain facts | ✅ | ❌ | ❌ | ✅ | ❌ |
| CRUD / version instructions | ✅ | ❌ | ❌ | ✅ | ❌ |
| Retrieve with `domainKey` | ✅ | ✅ | ✅ | ✅ | ✅† |
| Retrieve workspace-wide | ✅ | ✅ | ✅ | ✅ | ✅† |
| Dashboard domain managers | ✅ | ❌‡ | ❌‡ | ✅ | ❌ |

\* Agency/platform admin only within their agency/platform workspaces.

† Requires API key permission `retrieve` or session membership.

‡ Agency/platform admin UI deferred unless requested; API access OK.

---

## Route guards (Phase 6)

```ts
function enforceOperationalPermission(
  auth: AuthContext,
  required: OperationalRole | OperationalRole[],
  opts?: { workspaceId?: string; agencyId?: string; platformId?: string },
): boolean
```

- `middleware_admin` bypasses workspace checks for global catalog routes.
- All workspace routes validate `auth.workspaceId === body.workspaceId`.
- Hard delete routes: `required = ["middleware_admin"]` only.
- Archive routes: `workspace_admin` minimum.

---

## Dashboard access

- **WorkspaceUser** may never see Operational Intelligence nav (session role `workspace_user`).
- **WorkspaceAdmin** sees all five managers.
- **MiddlewareAdmin** sees managers + package catalog admin on platform routes (`/admin/packages`).

Session-only for write operations on domains/facts/packages (mirror existing `SESSION_ONLY_PREFIXES` pattern for platform admin).

---

## Security events

Emit on denial:

- `permission_denied` with `{ operationalRole, required, path }`

Existing `SecurityEvent` table — no new table in V1.
