import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveOperationalRoleForApiKey,
  resolveOperationalRoleFromMembership,
  roleMeetsMinimum,
} from "./operational-rbac.js";

describe("operational RBAC", () => {
  it("maps membership owner to workspace_admin when no operationalRole", () => {
    const role = resolveOperationalRoleFromMembership({
      isMiddlewareAdmin: false,
      isPlatformAdmin: false,
      agencyId: null,
      platformId: null,
      membershipRole: "owner",
      membershipOperationalRole: null,
    });
    assert.equal(role, "workspace_admin");
  });

  it("maps api key without admin to workspace_user", () => {
    assert.equal(resolveOperationalRoleForApiKey(["retrieve"]), "workspace_user");
  });

  it("workspace_user cannot meet package_workspace minimum", () => {
    assert.equal(roleMeetsMinimum("workspace_user", "workspace_admin"), false);
    assert.equal(roleMeetsMinimum("workspace_admin", "workspace_admin"), true);
  });

  it("only middleware_admin meets hard_delete", () => {
    assert.equal(roleMeetsMinimum("workspace_admin", "middleware_admin"), false);
    assert.equal(roleMeetsMinimum("middleware_admin", "middleware_admin"), true);
  });
});
