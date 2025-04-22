import type { z } from "zod";

import type { SyncManifestSchema } from "../manifest/manifest";

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
