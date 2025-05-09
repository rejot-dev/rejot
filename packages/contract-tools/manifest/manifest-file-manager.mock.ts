import { z } from "zod";

import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import type { MergedManifest } from "@rejot-dev/contract/manifest-merger";

import type { InitManifestOptions } from "./manifest.fs.ts";
import type { IManifestFileManager } from "./manifest-file-manager.ts";

type Manifest = z.infer<typeof SyncManifestSchema>;

export class MockManifestFileManager implements IManifestFileManager {
  private manifestMap = new Map<string, Manifest>();
  private mockManifestPath: string | null = null;

  constructor(mockManifestPath: string | null = null) {
    this.mockManifestPath = mockManifestPath;
  }

  async findManifestPath(
    _startDir: string = process.cwd(),
    _filename?: string,
    _recurse: boolean = true,
  ): Promise<string | null> {
    return this.mockManifestPath;
  }

  async writeManifest(path: string, manifest: Manifest): Promise<void> {
    this.manifestMap.set(path, manifest);
  }

  async readManifestOrGetEmpty(path: string): Promise<Manifest> {
    return (
      this.manifestMap.get(path) ?? {
        slug: "mock",
        manifestVersion: 1,
        connections: [],
        dataStores: [],
        eventStores: [],
        publicSchemas: [],
        consumerSchemas: [],
        workspaces: [],
      }
    );
  }

  async readManifest(path: string): Promise<Manifest | null> {
    return this.manifestMap.get(path) ?? null;
  }

  async initManifest(
    path: string,
    slug: string,
    options: InitManifestOptions = { workspace: false },
  ): Promise<Manifest> {
    const manifest: Manifest = {
      slug,
      manifestVersion: 1,
      connections: [],
      dataStores: [],
      eventStores: [],
      publicSchemas: [],
      consumerSchemas: [],
      workspaces: options.workspace ? [] : undefined,
    };
    this.manifestMap.set(path, manifest);
    return manifest;
  }

  async mergeAndUpdateManifest(
    path: string,
    manifests: Partial<Manifest>[],
  ): Promise<MergedManifest> {
    const currentManifest = await this.readManifestOrGetEmpty(path);
    const mergedManifest = manifests.reduce((acc, manifest) => {
      const definedProperties = Object.fromEntries(
        Object.entries(manifest).filter(([_, value]) => value !== undefined),
      );
      return { ...acc, ...definedProperties };
    }, currentManifest) as Manifest;
    await this.writeManifest(path, mergedManifest);
    return {
      manifest: mergedManifest,
      diagnostics: [],
    };
  }

  // Helper methods for testing
  reset(): void {
    this.manifestMap.clear();
    this.mockManifestPath = null;
  }

  setMockManifestPath(path: string | null): void {
    this.mockManifestPath = path;
  }

  getMockManifests(): Map<string, Manifest> {
    return new Map(this.manifestMap);
  }
}
