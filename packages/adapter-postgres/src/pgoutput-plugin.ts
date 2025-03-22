import { Client } from "pg";
import { PgoutputPlugin } from "pg-logical-replication";

export class RejotPgOutputPlugin extends PgoutputPlugin {
  constructor(options: { protoVersion: 1 | 2; publicationNames: string[]; messages?: boolean }) {
    super(options);
  }

  override start(client: Client, slotName: string, lastLsn: string) {
    return super.start(client, slotName, lastLsn);
  }
}
