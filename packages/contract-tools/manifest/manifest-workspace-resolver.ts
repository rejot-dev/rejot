import { dirname, join } from "node:path";

import { z } from "zod";

import { ReJotError } from "@rejot-dev/contract/error";
import { getLogger } from "@rejot-dev/contract/logger";
import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { SyncManifest, type SyncManifestOptions } from "@rejot-dev/contract/sync-manifest";
import type { ManifestWithPath, WorkspaceDefinition } from "@rejot-dev/contract/workspace";

import { DEFAULT_MANIFEST_FILENAME, readManifest, readManifestOrGetEmpty } from "./manifest.fs";
import { findManifestPath } from "./manifest.fs";

const log = getLogger(import.meta.url);

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

export interface IWorkspaceService {
  resolveWorkspace(projectDir: string): Promise<{ workspace: WorkspaceDefinition }>;
}

export class WorkspaceInitializationError extends ReJotError {
  get name(): string {
    return "WorkspaceInitializationError";
  }
}

export class WorkspaceService implements IWorkspaceService {
  readonly #workspaceResolver: IManifestWorkspaceResolver;

  constructor(workspaceResolver: IManifestWorkspaceResolver) {
    this.#workspaceResolver = workspaceResolver;
  }

  async resolveWorkspace(projectDir: string): Promise<{ workspace: WorkspaceDefinition }> {
    const workspace = await this.#workspaceResolver.resolveWorkspace({
      startDir: projectDir,
    });

    if (!workspace) {
      throw new WorkspaceInitializationError("No workspace found in project directory").withHint(
        "Create a new manifest if this is a new workspace",
      );
    }

    return {
      workspace,
    };
  }
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
