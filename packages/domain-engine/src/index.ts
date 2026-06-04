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
export { DomainEngineError, assertDomainSlug } from "./errors.js";
export { emitDomainEngineEvent, DOMAIN_ENGINE_EVENT_TYPES } from "./events.js";
export type {
  CreateDomainFactInput,
  CreateDomainInput,
  CreateGlobalFactInput,
  CreateInstructionInput,
  DomainEngineStore,
  ExecutionContextLoadResult,
  InstallPackageInput,
  UpdateDomainFactInput,
  UpdateDomainInput,
  UpdateGlobalFactInput,
  VersionInstructionInput,
} from "./store.js";
