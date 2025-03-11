import { type Connection, type RowDataPacket } from "mysql2/promise";
import { Readable } from "stream";

type BinlogInfo = {
  File: string;
  Position: number;
  Binlog_Do_DB: string;
  Binlog_Ignore_DB: string;
  Executed_Gtid_Set: string;
};

// https://github.com/sidorares/node-mysql2/blob/master/lib/packets/binlog_dump.js#L12
type BinlogOptions = {
  serverId: number;
  filename: string;
  binlogPos: number;
  flags: number;
};

export class MysqlBinlogListener {
  #connection: Connection;
  #binlogStream?: Readable;
  #onData: (data: unknown) => void;
  #isRunning = false;

  constructor(connection: Connection, onData: (data: unknown) => void) {
    this.#connection = connection;
    this.#onData = onData;
  }

  async prepare(): Promise<void> {
    await this.#connection.connect();

    await this.#checkBinlogStatus();
  }

  async #checkBinlogStatus(): Promise<void> {
    if (!this.#connection) {
      throw new Error("Connection not initialized");
    }

    // Check if binary logging is enabled on the server
    const [rows] = await this.#connection.query<RowDataPacket[]>("SHOW VARIABLES LIKE 'log_bin'");

    if (!rows.length || rows[0]["Value"] !== "ON") {
      throw new Error("Binary logging is not enabled on the MySQL server");
    }

    // Check if we have the required privileges
    const [userPrivileges] = await this.#connection.query<RowDataPacket[]>(
      "SHOW GRANTS FOR CURRENT_USER()",
    );

    const hasReplicationPrivilege = userPrivileges.some((row) => {
      const grant = Object.values(row)[0] as string;
      return grant.includes("REPLICATION SLAVE") || grant.includes("ALL PRIVILEGES");
    });

    if (!hasReplicationPrivilege) {
      throw new Error("Current MySQL user does not have REPLICATION SLAVE privilege");
    }
  }

  async #getBinlogInfo(): Promise<BinlogInfo> {
    const [binlogInfoRows] =
      await this.#connection.query<RowDataPacket[]>("SHOW BINARY LOG STATUS");

    if (binlogInfoRows.length !== 1) {
      throw new Error("Could not get binary log information");
    }

    return binlogInfoRows[0] as BinlogInfo;
  }

  async start(): Promise<boolean> {
    if (this.#isRunning) {
      return true;
    }

    try {
      // Get the connection object from the promise-based connection
      // @ts-expect-error - Accessing internal connection property
      const mysqlConnection = this.#connection.connection;

      if (!mysqlConnection) {
        throw new Error("Cannot access internal MySQL connection");
      }

      // Get server binary log information
      const binlogInfo = await this.#getBinlogInfo();
      console.log(binlogInfo);

      const binLogOpts: BinlogOptions = {
        serverId: 1 + Math.floor(Math.random() * 1000000),
        filename: binlogInfo.File,
        binlogPos: binlogInfo.Position,
        flags: 1,
      };
      console.log(binLogOpts);

      // Create the binlog stream

      // TODO: Getting an error from mysql about not being able to read the packet when opening the binlog stream
      // The COM_BINLOG_DUMP packet is likely now correctly implemented locally
      // I see the following response in wireshark from mysql:
      // MySQL Protocol - binlog event: Rotate
      // MySQL Protocol - binlog event: Format_desc
      // But they don't seem to be handled by mysql2
      this.#binlogStream = mysqlConnection.createBinlogStream(binLogOpts);

      // Handle events from the binlog stream
      if (this.#binlogStream) {
        this.#binlogStream.on("data", (event) => {
          console.log("ON DATA", event);
          this.#onData(event);
        });

        this.#binlogStream.on("error", (err) => {
          console.log("ON ERROR", err);
          console.error("Binlog stream error:", err);
        });
      }

      this.#isRunning = true;
      return true;
    } catch (error) {
      console.error("Failed to start binlog streaming:", error);
      return false;
    }
  }

  async stop(): Promise<void> {
    if (!this.#isRunning || !this.#binlogStream) {
      return;
    }

    // Remove all listeners to prevent memory leaks
    this.#binlogStream.removeAllListeners("data");
    this.#binlogStream.removeAllListeners("error");
    this.#binlogStream.removeAllListeners("end");

    // Destroy the stream if possible
    if (typeof this.#binlogStream.destroy === "function") {
      this.#binlogStream.destroy();
    }

    this.#binlogStream = undefined;
    this.#isRunning = false;
  }
}
