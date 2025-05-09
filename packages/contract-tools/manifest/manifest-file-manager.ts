import { z } from "zod";

import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import type { MergedManifest } from "@rejot-dev/contract/manifest-merger";

import type { InitManifestOptions } from "./manifest.fs.ts";
import {
  findManifestPath,
  initManifest,
  mergeAndUpdateManifest,
  readManifest,
  readManifestOrGetEmpty,
  writeManifest,
} from "./manifest.fs.ts";

type Manifest = z.infer<typeof SyncManifestSchema>;

export interface IManifestFileManager {
  findManifestPath(startDir?: string, filename?: string, recurse?: boolean): Promise<string | null>;
  writeManifest(path: string, manifest: Manifest): Promise<void>;
  readManifestOrGetEmpty(path: string): Promise<Manifest>;
  readManifest(path: string): Promise<Manifest | null>;
  initManifest(path: string, slug: string, options?: InitManifestOptions): Promise<Manifest>;
  mergeAndUpdateManifest(path: string, manifests: Partial<Manifest>[]): Promise<MergedManifest>;
}

export class ManifestFileManager implements IManifestFileManager {
  async findManifestPath(
    startDir: string = process.cwd(),
    filename?: string,
    recurse: boolean = true,
  ): Promise<string | null> {
    return findManifestPath(startDir, filename, recurse);
  }

  async writeManifest(path: string, manifest: Manifest): Promise<void> {
    await writeManifest(manifest, path);
  }

  async readManifestOrGetEmpty(path: string): Promise<Manifest> {
    return readManifestOrGetEmpty(path);
  }

  async readManifest(path: string): Promise<Manifest | null> {
    return readManifest(path);
  }

  async initManifest(
    path: string,
    slug: string,
    options: InitManifestOptions = { workspace: false },
  ): Promise<Manifest> {
    return initManifest(path, slug, options);
  }

  async mergeAndUpdateManifest(
    path: string,
    manifests: Partial<Manifest>[],
  ): Promise<MergedManifest> {
    return mergeAndUpdateManifest(path, manifests);
  }
}
