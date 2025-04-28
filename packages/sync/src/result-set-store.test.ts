import { describe, expect, test } from "bun:test";

import { ResultSetStore } from "./result-set-store.ts";

describe("Result set store", () => {
  test("Result set key parsing", () => {
    const resultSetStore = new ResultSetStore();
    expect(
      resultSetStore.getResultSetKeyForTableOperation({
        type: "insert",
        keyColumns: ["id"],
        table: "test",
        new: { id: 1, name: "test" },
      }),
    ).toEqual("test.id=1");
    expect(
      resultSetStore.getResultSetKeyForTableOperation({
        type: "update",
        keyColumns: ["id", "name"],
        table: "test",
        new: { id: 1, name: "test" },
      }),
    ).toEqual("test.id=1,test.name=test");
  });

  test("Result set keys for backfill parsing", () => {
    const resultSetStore = new ResultSetStore();

    expect(
      resultSetStore.getResultSetKeysForBackfill(
        [{ tableRef: "test", primaryKeyAliases: new Map([["id", "account_id"]]) }],
        { account_id: 1, name: "test" },
      ),
    ).toEqual(["test.id=1"]);

    expect(
      resultSetStore.getResultSetKeysForBackfill(
        [
          { tableRef: "test", primaryKeyAliases: new Map([["id", "account_id"]]) },
          { tableRef: "another", primaryKeyAliases: new Map([["id", "another_id"]]) },
        ],
        { account_id: 1, another_id: 2, name: "test" },
      ),
    ).toEqual(["test.id=1", "another.id=2"]);

    expect(
      resultSetStore.getResultSetKeysForBackfill(
        [
          {
            tableRef: "test",
            primaryKeyAliases: new Map([
              ["id", "account_id"],
              ["second_pkey", "some_id"],
            ]),
          },
        ],
        { account_id: 1, some_id: 2, name: "test" },
      ),
    ).toEqual(["test.id=1,test.second_pkey=2"]);
  });

  test("Result set store excludes dropped keys", () => {
    const resultSetStore = new ResultSetStore();

    resultSetStore.addDropKey({
      type: "insert",
      keyColumns: ["id"],
      table: "test",
      new: { id: 1, name: "test" },
    });

    resultSetStore.addDropKey({
      type: "insert",
      keyColumns: ["id"],
      table: "other",
      new: { id: 2, name: "test" },
    });

    resultSetStore.addRecords(
      [
        { tableRef: "test", primaryKeyAliases: new Map([["id", "test_id"]]) },
        { tableRef: "other", primaryKeyAliases: new Map([["id", "other_id"]]) },
      ],
      [
        { test_id: 1, name: "test", other_id: 1 }, // invalidated by test.id=1 drop key
        { test_id: 2, name: "test", other_id: 2 }, // invalidated by other.id=2 drop key
        { test_id: 3, name: "test", other_id: 3 }, // valid
      ],
    );

    expect(resultSetStore.getRecordsWithoutDropKeys()).toEqual([
      [["test_id", "other_id"], { test_id: 3, name: "test", other_id: 3 }],
    ]);
  });
});
