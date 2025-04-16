import { glob } from "glob";

import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { z } from "zod";
import { DEFAULT_MANIFEST_FILENAME, readManifest } from "./manifest.fs";
import { dirname, join, relative } from "node:path";
import { findManifestPath } from "./manifest.fs";
import { SyncManifest, type SyncManifestOptions } from "@rejot-dev/contract/sync-manifest";

export interface Workspace {
  rootPath: string;
  ancestor: {
    path: string;
    manifest: z.infer<typeof SyncManifestSchema>;
  };

  children: {
    path: string;
    manifest: z.infer<typeof SyncManifestSchema>;
  }[];
}

export interface ResolveWorkspaceOptions {
  startDir?: string;
  filename?: string;
  absolutePaths?: boolean;
}

export interface ManifestInfo {
  path: string;
  manifest: z.infer<typeof SyncManifestSchema>;
  rootPath: string;
}

export interface IManifestWorkspaceResolver {
  resolveWorkspace(options?: ResolveWorkspaceOptions): Promise<Workspace | null>;
  getManifestInfo(filePath: string): Promise<ManifestInfo>;
  workspaceToSyncManifest(workspace: Workspace): SyncManifest;
}

export class ManifestWorkspaceResolver implements IManifestWorkspaceResolver {
  async getManifestInfo(filePath: string): Promise<ManifestInfo> {
    const manifest = await readManifest(filePath);
    const rootPath = dirname(filePath);

    return {
      path: filePath,
      manifest,
      rootPath,
    };
  }

  async resolveWorkspace(options: ResolveWorkspaceOptions = {}): Promise<Workspace | null> {
    const {
      startDir = process.cwd(),
      filename = DEFAULT_MANIFEST_FILENAME,
      absolutePaths = false,
    } = options;

    // Find the ancestor manifest path
    const manifestPath = await findManifestPath(startDir, filename);
    if (!manifestPath) {
      return null;
    }

    const ancestorManifest = await readManifest(manifestPath);

    const rootPath = dirname(manifestPath);
    const result: Workspace = {
      rootPath,
      ancestor: {
        path: absolutePaths ? manifestPath : filename,
        manifest: ancestorManifest,
      },
      children: [],
    };

    // If no workspaces defined, return just the ancestor
    if (!ancestorManifest.workspaces || ancestorManifest.workspaces.length === 0) {
      return result;
    }

    // Find all child manifests based on workspace patterns
    const childPaths: string[] = [];

    for (const workspacePattern of ancestorManifest.workspaces) {
      const absolutePattern = join(rootPath, workspacePattern);
      const directories = await glob(absolutePattern);

      for (const directory of directories) {
        const childManifestPath = await findManifestPath(directory);
        if (childManifestPath && childManifestPath !== manifestPath) {
          childPaths.push(childManifestPath);
        }
      }
    }

    // Read child manifests
    for (const childPath of childPaths) {
      const childManifest = await readManifest(childPath);

      const pathToUse = absolutePaths ? childPath : relative(rootPath, childPath);

      result.children.push({
        path: pathToUse,
        manifest: childManifest,
      });
    }

    return result;
  }

  workspaceToSyncManifest(workspace: Workspace, options: SyncManifestOptions = {}): SyncManifest {
    return workspaceToSyncManifest(workspace, options);
  }
}

export function workspaceToSyncManifest(
  workspace: Workspace,
  options: SyncManifestOptions = {},
): SyncManifest {
  return new SyncManifest(
    [workspace.ancestor.manifest, ...workspace.children.map((child) => child.manifest)],
    options,
  );
}
