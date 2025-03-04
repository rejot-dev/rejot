import { Command, Flags } from "@oclif/core";

export default class SyncCommand extends Command {
  static override description = "Start a syncing process between two datastores";

  static override examples = [
    '<%= config.bin %> --source-conn "postgresql://user:pass@host:port/db" --dest-conn "postgresql://user:pass@host:port/db" --public-schema ./public-schema.sql --consumer-schema ./consumer-schema.sql',
  ];

  static override flags = {
    "source-conn": Flags.string({
      description: "PostgreSQL connection string for the source database",
      required: true,
    }),
    "dest-conn": Flags.string({
      description: "PostgreSQL connection string for the destination database",
      required: true,
    }),
    "public-schema": Flags.string({
      description: "Path to the SQL file containing the public schema transformation",
      required: true,
    }),
    "consumer-schema": Flags.string({
      description: "Path to the SQL file containing the consumer schema transformation",
      required: true,
    }),
  };

  static override args = {};

  public async run(): Promise<void> {
    const { args: _args, flags } = await this.parse(SyncCommand);

    // Extract connection strings and schema files
    const sourceConn = flags["source-conn"];
    const destConn = flags["dest-conn"];
    const publicSchemaPath = flags["public-schema"];
    const consumerSchemaPath = flags["consumer-schema"];

    this.log(`Starting sync process:`);
    this.log(`- Source connection: ${this.maskConnectionString(sourceConn)}`);
    this.log(`- Destination connection: ${this.maskConnectionString(destConn)}`);
    this.log(`- Public schema file: ${publicSchemaPath}`);
    this.log(`- Consumer schema file: ${consumerSchemaPath}`);

    // TODO: Implement the actual sync logic
    // 1. Read SQL files
    // 2. Connect to source and destination databases
    // 3. Apply transformations and sync data
  }

  private maskConnectionString(connString: string): string {
    try {
      const url = new URL(connString);
      // Mask password if present
      if (url.password) {
        url.password = "****";
      }
      return url.toString();
    } catch {
      // If parsing fails, return a generic masked string
      return connString.replace(/:[^:@]+@/, ":****@");
    }
  }
}
