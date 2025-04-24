import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as esbuild from "esbuild";

import { getLogger } from "@rejot-dev/contract/logger";

const log = getLogger(import.meta.url);

export interface ITypeStripper {
  processSupportsTypeStripping(): boolean;
  stripTypes(typescriptFilePath: string): Promise<string>;
}

export class TypeStripper implements ITypeStripper {
  async stripTypes(typescriptFilePath: string): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), "type-stripper-"));
    const outFile = join(tmpDir, typescriptFilePath + ".js");

    await esbuild.build({
      entryPoints: [typescriptFilePath],
      outfile: outFile,
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
    });

    log.debug(`Stripped types from ${typescriptFilePath} to ${outFile}`);

    return outFile;
  }

  processSupportsTypeStripping(): boolean {
    if (process["isBun"]) {
      return true;
    }

    if (process.versions["deno"]) {
      return true;
    }

    if (process.version.startsWith("v23")) {
      return true;
    }

    return (
      process.version.startsWith("v22.6") && process.execArgv.includes("--experimental-strip-types")
    );
  }
}
