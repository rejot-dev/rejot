import type { z } from "zod";

import type { SyncManifestSchema } from "../manifest/manifest";
import { type VerificationResult, verifyManifestsWithPaths } from "../manifest/verify-manifest";

export interface ManifestWithPath {
  /** Path is relative to the rootPath in the workspace. */
  path: string;
  manifest: z.infer<typeof SyncManifestSchema>;
}

export interface WorkspaceDefinition {
  /** Absolute path */
  rootPath: string;
  ancestor: ManifestWithPath;
  children: ManifestWithPath[];
}

/**
 * Verifies a workspace by checking all manifests within it.
 * This includes the ancestor manifest and all child manifests.
 *
 * @param workspace The workspace to verify
 * @param checkPublicSchemaReferences Whether to verify public schema references across manifests
 * @returns A VerificationResult containing any errors, warnings, and external references
 */
export function verifyWorkspace(
  workspace: WorkspaceDefinition,
  checkPublicSchemaReferences = true,
): VerificationResult {
  // Combine ancestor and children into a single array for verification
  const allManifests = [workspace.ancestor, ...workspace.children];

  return verifyManifestsWithPaths(allManifests, checkPublicSchemaReferences);
}
