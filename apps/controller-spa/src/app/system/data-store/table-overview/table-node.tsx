import { Handle, Position } from "@xyflow/react";
import { TableProperties } from "lucide-react";

type Column = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  tableSchema: string;
  foreignKey?: {
    constraintName: string;
    referencedTableSchema: string;
    referencedTableName: string;
    referencedColumnName: string;
  };
};

type TableNodeData = {
  name: string;
  schema: string;
  columns: Column[];
};

function getForeignKeyHandleId(table: string, column: Column) {
  return `${column.tableSchema}.${table}.${column.columnName}`;
}

export function TableNode({ data }: { data: TableNodeData }) {
  return (
    <div className="overflow-hidden rounded-lg border border-blue-600 dark:bg-blue-950">
      <div className="flex items-center gap-2 bg-blue-200 p-2 font-semibold dark:bg-blue-900">
        <TableProperties />
        {data.schema}.{data.name}
      </div>
      <div>
        {data.columns.map((column, index) => (
          <div
            key={index}
            className="relative flex flex-row items-center justify-between p-2 font-mono text-sm odd:bg-white even:bg-gray-100 dark:odd:bg-gray-600 dark:even:bg-gray-700"
          >
            <div className="flex items-center">{column.columnName}</div>
            <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              {column.dataType}
              {column.isNullable ? "?" : ""}
            </div>
            {/* Source handle for this column */}
            <Handle
              type="source"
              position={Position.Left}
              id={getForeignKeyHandleId(data.name, column)}
            />
            {/* Target handle for foreign key references to this column */}
            <Handle
              type="target"
              position={Position.Right}
              id={`${data.schema}.${data.name}.${column.columnName}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
