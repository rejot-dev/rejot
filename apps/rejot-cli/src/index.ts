import "./metrics-sdk.ts";

import { ConsoleLogger } from "@rejot-dev/contract/logger";
import { setLogger } from "@rejot-dev/contract/logger";

import { Command, execute, Plugin } from "@oclif/core";
import type { PJSON } from "@oclif/core/interfaces";

import packagejson from "../package.json" with { type: "json" };
import CollectCommand from "./commands/collect-command.ts";
import { ManifestInfoCommand } from "./commands/manifest/manifest-info.command.ts";
import { ManifestInitCommand } from "./commands/manifest/manifest-init.command.ts";
import { ManifestSyncCommand } from "./commands/manifest/manifest-sync.command.ts";
import { ManifestConnectionAddCommand } from "./commands/manifest-connection/manifest-connection-add.command.ts";
import { ManifestConnectionListCommand } from "./commands/manifest-connection/manifest-connection-list.command.ts";
import { ManifestConnectionRemoveCommand } from "./commands/manifest-connection/manifest-connection-remove.command.ts";
import { ManifestConnectionUpdateCommand } from "./commands/manifest-connection/manifest-connection-update.command.ts";
import { ManifestDataStoreAddCommand } from "./commands/manifest-datastore/manifest-datastore-add.command.ts";
import { ManifestDataStoreListCommand } from "./commands/manifest-datastore/manifest-datastore-list.command.ts";
import { ManifestDataStoreRemoveCommand } from "./commands/manifest-datastore/manifest-datastore-remove.command.ts";
import { ManifestEventStoreAddCommand } from "./commands/manifest-eventstore/manifest-eventstore-add.command.ts";
import { ManifestEventStoreListCommand } from "./commands/manifest-eventstore/manifest-eventstore-list.command.ts";
import { ManifestEventStoreRemoveCommand } from "./commands/manifest-eventstore/manifest-eventstore-remove.command.ts";
import { WorkspaceInfoCommand } from "./commands/workspace/workspace-info.command.ts";
import { WorkspaceInitCommand } from "./commands/workspace/workspace-init.command.ts";

export const commands = {
  collect: CollectCommand,
  "manifest:info": ManifestInfoCommand,
  "manifest:init": ManifestInitCommand,
  "manifest:connection:add": ManifestConnectionAddCommand,
  "manifest:connection:remove": ManifestConnectionRemoveCommand,
  "manifest:connection:list": ManifestConnectionListCommand,
  "manifest:connection:update": ManifestConnectionUpdateCommand,
  "manifest:datastore:add": ManifestDataStoreAddCommand,
  "manifest:datastore:remove": ManifestDataStoreRemoveCommand,
  "manifest:datastore:list": ManifestDataStoreListCommand,
  "manifest:eventstore:add": ManifestEventStoreAddCommand,
  "manifest:eventstore:remove": ManifestEventStoreRemoveCommand,
  "manifest:eventstore:list": ManifestEventStoreListCommand,
  "manifest:sync": ManifestSyncCommand,
  "workspace:info": WorkspaceInfoCommand,
  "workspace:init": WorkspaceInitCommand,
};

setLogger(new ConsoleLogger("DEBUG"));

// PJSON, is simply a type that oclif uses to load the package.json file.
// We need to cast it to the PJSON type to avoid type errors, as our package.json contains the oclif field, bun just doesn't know about it.
const pjson = packagejson as unknown as PJSON;

export class PreloadedRejotCli extends Plugin {
  /**
   * This plugin is used to preload the rejot-cli commands, so we do not have to rely on oclif's dynamic loading (which requires the package.json to be present in the root of the project).
   * This also means we can now use bun compile to build the rejot-cli binary, and it will work out of the box.
   */

  constructor() {
    super({
      name: "rejot-cli",
      root: import.meta.url,
    });
  }

  pjson = pjson;
  hooks = {};

  commands: Command.Loadable[] = Object.values(commands).map((command) => {
    return {
      load: async () => {
        return command;
      },
      aliases: [],
      args: command.args,
      flags: command.flags,
      hidden: command.hidden,
      hasDynamicHelp: command.hasDynamicHelp,
      deprecateAliases: command.deprecateAliases,
      id: command.id.replaceAll(" ", ":"),
      hiddenAliases: command.hiddenAliases,
      description: command.description,
      examples: command.examples,
    };
  });
}

export async function run() {
  const plugin = new PreloadedRejotCli();
  await execute({
    dir: import.meta.url,
    loadOptions: {
      isRoot: true,
      pjson,
      root: import.meta.url,
      pluginAdditions: {
        core: [PreloadedRejotCli.name],
      },
      plugins: new Map([[PreloadedRejotCli.name, plugin]]),
    },
  });
}
