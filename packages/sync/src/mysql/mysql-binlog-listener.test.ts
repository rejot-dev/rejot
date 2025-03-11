import { createConnection } from "mysql2/promise";
import { MysqlBinlogListener } from "./mysql-binlog-listener";
import { describe, test } from "bun:test";

const testConnectionString = "mysql://root:example@localhost:3306/test";

describe("MysqlBinlogListener", () => {
  test("Replication log works", async () => {
    const connection = await createConnection(testConnectionString);
    const { promise, resolve } = Promise.withResolvers<void>();

    const listener = new MysqlBinlogListener(connection, (data) => {
      console.log("EVENT", data);
      resolve();
    });
    await listener.prepare();
    console.log("PREPARED, STARTING");
    listener.start();
    console.log("STARTED WAITING FOR DATA");

    await connection.query("INSERT INTO test (name) VALUES ('test')");
    console.log("INSERTED");

    await promise;
  }, 15000);
});
