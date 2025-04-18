import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { z } from "zod";
import { DEFAULT_MANIFEST_FILENAME, readManifest, readManifestOrGetEmpty } from "./manifest.fs";
import { dirname, join } from "node:path";
import { findManifestPath } from "./manifest.fs";
import { SyncManifest, type SyncManifestOptions } from "@rejot-dev/contract/sync-manifest";
import { getLogger } from "@rejot-dev/contract/logger";

const log = getLogger(import.meta.url);

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

export interface ResolveWorkspaceOptions {
  startDir?: string;
  filename?: string;
}

export interface ManifestInfo {
  path: string;
  manifest: z.infer<typeof SyncManifestSchema>;
  rootPath: string;
}

export interface IManifestWorkspaceResolver {
  resolveWorkspace(options?: ResolveWorkspaceOptions): Promise<WorkspaceDefinition | null>;
  getManifestInfo(filePath: string): Promise<ManifestInfo>;
  workspaceToSyncManifest(workspace: WorkspaceDefinition): SyncManifest;
}

export class ManifestWorkspaceResolver implements IManifestWorkspaceResolver {
  async getManifestInfo(filePath: string): Promise<ManifestInfo> {
    const manifest = await readManifestOrGetEmpty(filePath);
    const rootPath = dirname(filePath);

    return {
      path: filePath,
      manifest,
      rootPath,
    };
  }

  async resolveWorkspace(
    options: ResolveWorkspaceOptions = {},
  ): Promise<WorkspaceDefinition | null> {
    const { startDir = process.cwd(), filename = DEFAULT_MANIFEST_FILENAME } = options;

    // Find the ancestor manifest path
    const manifestPath = await findManifestPath(startDir, filename);
    if (!manifestPath) {
      log.warn("resolveWorkspace did not find a manifest");
      return null;
    }

    log.info("resolveWorkspace found a manifest", { manifestPath });

    const ancestorManifest = await readManifestOrGetEmpty(manifestPath);

    const rootPath = dirname(manifestPath);
    const result: WorkspaceDefinition = {
      rootPath,
      ancestor: {
        path: filename,
        manifest: ancestorManifest,
      },
      children: [],
    };

    // If no workspaces defined, return just the ancestor
    if (!ancestorManifest.workspaces || ancestorManifest.workspaces.length === 0) {
      return result;
    }

    // Read child manifests
    for (const childPath of ancestorManifest.workspaces) {
      const absoluteChildPath = join(rootPath, childPath);

      const childManifest = await readManifest(absoluteChildPath);
      if (!childManifest) {
        continue;
      }

      result.children.push({
        path: childPath, // Use the original relative path from the manifest
        manifest: childManifest,
      });
    }

    return result;
  }

  workspaceToSyncManifest(
    workspace: WorkspaceDefinition,
    options: SyncManifestOptions = {},
  ): SyncManifest {
    return workspaceToSyncManifest(workspace, options);
  }
}

export function workspaceToSyncManifest(
  workspace: WorkspaceDefinition,
  options: SyncManifestOptions = {},
): SyncManifest {
  return new SyncManifest(
    [workspace.ancestor.manifest, ...workspace.children.map((child) => child.manifest)],
    options,
  );
}

export function getManifestBySlug(
  workspace: WorkspaceDefinition,
  slug: string,
): ManifestWithPath | null {
  if (workspace.ancestor.manifest.slug === slug) {
    return workspace.ancestor;
  }

  return workspace.children.find((child) => child.manifest.slug === slug) ?? null;
}
