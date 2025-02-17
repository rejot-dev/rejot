import { tokens } from "typed-inject";
import type { IConnectionService } from "./connection-service.ts";
import type { IConnectionManager } from "./connection-manager.ts";
import type { ISchemaRepository } from "./schema-repository.ts";
import type { ColumnSchema } from "@rejot/api-interface-controller/connection-health";

export type SchemaChange = {
  changeType:
    | "column_added"
    | "column_removed"
    | "type_changed"
    | "nullability_changed"
    | "default_changed";
  details: string;
  column: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
};

export interface ISchemaService {
  getSchemaChanges(params: {
    organizationCode: string;
    connectionSlug: string;
    schemaName: string;
    tableName: string;
  }): Promise<{
    changes: SchemaChange[];
    snapshotDate: string;
  }>;
}

export class SchemaService implements ISchemaService {
  static inject = tokens("connectionService", "postgresConnectionManager", "schemaRepository");

  constructor(
    private connectionService: IConnectionService,
    private postgresConnectionManager: IConnectionManager,
    private schemaRepository: ISchemaRepository,
  ) {}

  async getSchemaChanges(params: {
    organizationCode: string;
    connectionSlug: string;
    schemaName: string;
    tableName: string;
  }) {
    const connection = await this.connectionService.getBySlugWithPassword(
      params.organizationCode,
      params.connectionSlug,
    );

    const currentSchema = await this.postgresConnectionManager.getTableSchema(
      params.organizationCode,
      connection.slug,
      params.tableName,
    );
    const snapshot = await this.schemaRepository.getLatestSnapshot({
      connectionSlug: connection.slug,
      schemaName: params.schemaName,
      tableName: params.tableName,
    });

    // Create initial snapshot if none exists
    if (!snapshot) {
      // TODO: Make sure snapshot is created on publication creation
      const newSnapshot = await this.schemaRepository.createSnapshot({
        connectionSlug: connection.slug,
        schemaName: params.schemaName,
        tableName: params.tableName,
        schema: this.convertToTableSchema(currentSchema),
      });

      return {
        changes: [],
        snapshotDate: newSnapshot.createdAt.toISOString(),
      };
    }

    const changes = this.compareSchemas(snapshot.schema, this.convertToTableSchema(currentSchema));

    // If there are changes, create a new snapshot
    if (changes.changes.length > 0) {
      return {
        changes: changes.changes,
        snapshotDate: snapshot.createdAt.toISOString(),
      };
    }

    return {
      changes: [],
      snapshotDate: snapshot.createdAt.toISOString(),
    };
  }

  private convertToTableSchema(columns: ColumnSchema[]): Record<string, ColumnSchema> {
    return columns.reduce(
      (acc, column) => {
        acc[column.columnName] = column;
        return acc;
      },
      {} as Record<string, ColumnSchema>,
    );
  }

  private compareSchemas(
    oldSchema: Record<string, ColumnSchema>,
    newSchema: Record<string, ColumnSchema>,
  ): { changes: SchemaChange[] } {
    const changes: SchemaChange[] = [];
    const timestamp = new Date().toISOString();

    // Check for modified and removed columns
    for (const columnName in oldSchema) {
      const oldColumn = oldSchema[columnName];
      const newColumn = newSchema[columnName];

      if (newColumn === undefined) {
        changes.push({
          changeType: "column_removed" as const,
          details: `Column "${columnName}" was removed`,
          timestamp,
          column: columnName,
          oldValue: oldColumn.dataType,
        });
        continue;
      }

      // Check for type changes
      if (oldColumn.dataType !== newColumn.dataType) {
        changes.push({
          changeType: "type_changed" as const,
          details: `Column "${columnName}" type changed from ${oldColumn.dataType} to ${newColumn.dataType}`,
          timestamp,
          column: columnName,
          oldValue: oldColumn.dataType,
          newValue: newColumn.dataType,
        });
      }

      // Check for nullability changes
      if (oldColumn.isNullable !== newColumn.isNullable) {
        changes.push({
          changeType: "nullability_changed" as const,
          details: `Column "${columnName}" nullability changed from ${oldColumn.isNullable} to ${newColumn.isNullable}`,
          timestamp,
          column: columnName,
          oldValue: String(oldColumn.isNullable),
          newValue: String(newColumn.isNullable),
        });
      }

      // Check for default value changes
      if (oldColumn.columnDefault !== newColumn.columnDefault) {
        changes.push({
          changeType: "default_changed" as const,
          details: `Column "${columnName}" default value changed from ${oldColumn.columnDefault} to ${newColumn.columnDefault}`,
          timestamp,
          column: columnName,
          oldValue: oldColumn.columnDefault ?? "null",
          newValue: newColumn.columnDefault ?? "null",
        });
      }
    }

    // Check for added columns
    for (const columnName in newSchema) {
      if (oldSchema[columnName] === undefined) {
        const newColumn = newSchema[columnName];
        if (newColumn) {
          changes.push({
            changeType: "column_added" as const,
            details: `Column "${columnName}" was added with type ${newColumn.dataType}`,
            timestamp,
            column: columnName,
            newValue: newColumn.dataType,
          });
        }
      }
    }

    return { changes };
  }
}
