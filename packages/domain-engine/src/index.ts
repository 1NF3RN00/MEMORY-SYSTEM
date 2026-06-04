export type {
  ChunkMetadataLookup,
  ApplyFactOverridesInput,
  ApplyFactOverridesResult,
} from "./fact-precedence.js";
export { applyFactOverridesToMemories } from "./fact-precedence.js";
export {
  resolveDomainExecutionContext,
  type ResolveExecutionContextDeps,
  type ResolveExecutionContextInput,
} from "./execution-context.js";
export { addGlobalFact, updateGlobalFact, archiveGlobalFact, deleteGlobalFact } from "./global-facts.js";
export { createDomain, updateDomain, archiveDomain, deleteDomain } from "./domains.js";
export { addFact, updateFact, archiveFact, deleteFact } from "./domain-facts.js";
export {
  createInstruction,
  updateInstruction,
  versionInstruction,
  archiveInstruction,
} from "./instructions.js";
export { comparePackageManifests } from "./compare-manifest.js";
export {
  installPackage,
  exportPackage,
  clonePackage,
  updatePackage,
  comparePackage,
  rollbackPackage,
  archiveInstalledPackage,
} from "./packages.js";
export {
  createOperationalObject,
  updateOperationalObject,
  archiveOperationalObject,
  deleteOperationalObject,
  listOperationalObjects,
} from "./operational-objects.js";
export { DomainEngineError, assertDomainSlug } from "./errors.js";
export { emitDomainEngineEvent, DOMAIN_ENGINE_EVENT_TYPES } from "./events.js";
export type {
  CreateDomainFactInput,
  CreateDomainInput,
  CreateGlobalFactInput,
  CreateInstructionInput,
  CreateOperationalObjectInput,
  DomainEngineStore,
  ExecutionContextLoadResult,
  InstallPackageInput,
  ListOperationalObjectsQuery,
  UpdateDomainFactInput,
  UpdateDomainInput,
  UpdateGlobalFactInput,
  UpdateOperationalObjectInput,
  VersionInstructionInput,
} from "./store.js";
