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

export class ResultSetStore {
  #records: Record<string, unknown>[] = [];
  #keyToRecordIndex: Map<ResultSetKey, number> = new Map();
  #dropKeys: Set<ResultSetKey> = new Set();

  constructor() {}

  /**
   * We receive a batch of records from a backfill.
   * Each of them gets added to our state: this.#records
   *
   * We have to keep track of all primary keys that were modified, so we know which records to drop from the backfill.
   *
   * @param backfillSources
   * @param records
   */

  addRecords(backfillSources: BackfillSource[], records: Record<string, unknown>[]) {
    for (const record of records) {
      const recordIndex = this.#records.length;
      this.#records.push(record);
      const resultSetKeys = this.getResultSetKeysForBackfill(backfillSources, record);

      // There is a key for each table used within the backfill
      for (const resultSetKey of resultSetKeys) {
        this.#keyToRecordIndex.set(resultSetKey, recordIndex);
      }
    }
  }

  addDropKey(op: TableOperation) {
    console.log("addDropKey", op, this.getResultSetKeyForTableOperation(op));
    this.#dropKeys.add(this.getResultSetKeyForTableOperation(op));
  }

  getRecordsWithoutDropKeys() {
    const excludedRecordIndexes = new Set(
      Array.from(this.#dropKeys).map((key) => this.#keyToRecordIndex.get(key)),
    );

    return this.#records.filter((_, index) => !excludedRecordIndexes.has(index));
  }

  /**
   * A single result transformation consists of one or more source tables.
   * We want to invalidate the entire record, if any of the source tables have been modified.
   *
   * This method receives a record from a backfill, so with the transformation already applied.
   *
   * @param backfillSources
   * @param record
   * @returns
   */
  getResultSetKeysForBackfill(
    backfillSources: BackfillSource[],
    record: Record<string, unknown>,
  ): ResultSetKey[] {
    if (backfillSources.length === 0) {
      throw new Error("Backfill source must contain at least one table");
    }

    const resultSetKeys: string[] = [];
    // For every one of our tables
    for (const source of backfillSources) {
      // Check for changes in record with the source table.sourcekey = the primary key.
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
