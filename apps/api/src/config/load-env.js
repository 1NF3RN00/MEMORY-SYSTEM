import { config as loadEnvFile } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const currentDir = dirname(fileURLToPath(import.meta.url));
// apps/api/src/config -> repo root is four levels up
const repoRootEnv = resolve(currentDir, "../../../../.env");
// Optional app-local overrides: apps/api/.env
const appEnv = resolve(currentDir, "../../../.env");
loadEnvFile({ path: repoRootEnv });
loadEnvFile({ path: appEnv });
export function getRepoRootEnvPath() {
    return repoRootEnv;
}
//# sourceMappingURL=load-env.js.map