import type { TableOperation } from "@rejot-dev/contract/sync";

type ResultSetKey = string;

/* 
Mapping that links source table primary keys to those same columns in the public schema.

We use the public schema sql to initiate a backfill, in order to determine wether a 
a record in that backfill has been invalidated, we check if updates to one of the source
tables matches a row in the backfill. We match on the primary key values.


  Example:
  Source tables: account(id, name), address(id, street)
  Public schema: {account_id, address_id, name, street}
   
  BackfillSource[]: [{
    tableRef: "public.account",
    primaryKeyAliases: {"id": "account_id"}
  }, {
    tableRef: "public.address",
    primaryKeyAliases: {"id": "address_id"}
  }]
*/
export type BackfillSource = {
  tableRef: string;
  primaryKeyAliases: Map<string, string>;
};

type PrimaryKeyColumns = string[];
type PrimaryKeyRecord = [PrimaryKeyColumns, Record<string, unknown>];

export class ResultSetStore {
  #records: PrimaryKeyRecord[] = [];
  #keyToRecordIndex: Map<ResultSetKey, number> = new Map();
  #dropKeys: Set<ResultSetKey> = new Set();

  constructor() {}

  addRecords(backfillSources: BackfillSource[], records: Record<string, unknown>[]) {
    for (const record of records) {
      const recordIndex = this.#records.length;
      this.#records.push([
        // Primary key columns for public schema
        backfillSources.flatMap((s) => Array.from(s.primaryKeyAliases.values())),
        record,
      ]);

      const resultSetKeys = this.getResultSetKeysForBackfill(backfillSources, record);

      // There is a key for each table used within the backfill
      for (const resultSetKey of resultSetKeys) {
        this.#keyToRecordIndex.set(resultSetKey, recordIndex);
      }
    }
  }

  addDropKey(op: TableOperation) {
    this.#dropKeys.add(this.getResultSetKeyForTableOperation(op));
  }

  getRecordsWithoutDropKeys() {
    const excludedRecordIndexes = new Set(
      Array.from(this.#dropKeys).map((key) => this.#keyToRecordIndex.get(key)),
    );

    return this.#records.filter((_, index) => !excludedRecordIndexes.has(index));
  }

  getResultSetKeysForBackfill(
    backfillSources: BackfillSource[],
    record: Record<string, unknown>,
  ): ResultSetKey[] {
    if (backfillSources.length === 0) {
      throw new Error("Backfill source must contain at least one table");
    }

    const resultSetKeys: string[] = [];
    for (const source of backfillSources) {
      const primaryKeyValues: string[] = [];
      for (const [sourceKey, resultKey] of source.primaryKeyAliases.entries()) {
        primaryKeyValues.push(`${source.tableRef}.${sourceKey}=${record[resultKey]}`);
      }
      resultSetKeys.push(primaryKeyValues.sort().join(","));
    }
    return resultSetKeys;
  }

  getResultSetKeyForTableOperation(operation: TableOperation): ResultSetKey {
    if (operation.type === "delete") {
      throw new Error("Delete operations are not supported yet");
    }
    const columnValues = operation.keyColumns
      .sort()
      .map((column) => `${operation.table}.${column}=${operation.new[column]}`);
    return columnValues.join(",");
  }

  clear() {
    this.#records = [];
    this.#keyToRecordIndex.clear();
    this.#dropKeys.clear();
  }

  size() {
    return this.#records.length;
  }
}
