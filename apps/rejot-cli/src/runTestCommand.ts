import { runCommand as oldRunCommand } from "@oclif/test";

import type { LoadOptions } from "@oclif/core/interfaces";

import { PreloadedRejotCli } from ".";

export function runCommand(args: string | string[]) {
  const oclifLoadOpts: LoadOptions = {
    isRoot: true,
    root: import.meta.url,
    pluginAdditions: {
      core: [PreloadedRejotCli.name],
    },
    plugins: new Map([[PreloadedRejotCli.name, new PreloadedRejotCli()]]),
  };

  return oldRunCommand(args, oclifLoadOpts);
}
