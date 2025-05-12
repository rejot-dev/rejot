import { ConsoleLogger } from "@rejot-dev/contract/logger";
import { setLogger } from "@rejot-dev/contract/logger";

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
