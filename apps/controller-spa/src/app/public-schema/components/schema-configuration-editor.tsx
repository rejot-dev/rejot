import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Pencil, PencilOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface SchemaColumn {
  id: string;
  columnName: string;
  dataType: string;
}

interface SchemaConfigurationEditorProps {
  schema: SchemaColumn[];
  onChange: (schema: SchemaColumn[]) => void;
  suggestedColumns?: Omit<SchemaColumn, "id">[];
}

const DATA_TYPES = ["string", "number", "boolean"] as const;

export function SchemaConfigurationEditor({
  schema,
  onChange,
  suggestedColumns = [],
}: SchemaConfigurationEditorProps) {
  const { toast } = useToast();
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<(typeof DATA_TYPES)[number]>("string");
  const [editingColumns, setEditingColumns] = useState<Set<string>>(new Set());

  const toggleEditMode = (id: string) => {
    const newEditingColumns = new Set(editingColumns);
    if (newEditingColumns.has(id)) {
      newEditingColumns.delete(id);
    } else {
      newEditingColumns.add(id);
    }
    setEditingColumns(newEditingColumns);
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      toast({
        title: "Invalid column name",
        description: "Please enter a column name",
        variant: "destructive",
      });
      return;
    }

    if (schema.some((col) => col.columnName === newColumnName)) {
      toast({
        title: "Duplicate column",
        description: "A column with this name already exists",
        variant: "destructive",
      });
      return;
    }

    onChange([
      ...schema,
      {
        id: crypto.randomUUID(),
        columnName: newColumnName,
        dataType: newColumnType,
      },
    ]);
    setNewColumnName("");
    setNewColumnType("string");
  };

  const handleRemoveColumn = (id: string) => {
    onChange(schema.filter((col) => col.id !== id));
  };

  const handleUpdateColumn = (id: string, updates: Partial<Omit<SchemaColumn, "id">>) => {
    const newColumnName = updates.columnName?.trim();

    if (newColumnName) {
      const existingColumn = schema.find(
        (col) => col.columnName === newColumnName && col.id !== id,
      );
      if (existingColumn) {
        toast({
          title: "Duplicate column",
          description: "A column with this name already exists",
          variant: "destructive",
        });
        return;
      }
    }

    onChange(schema.map((col) => (col.id === id ? { ...col, ...updates } : col)));
  };

  const handleMoveColumn = (id: string, direction: "up" | "down") => {
    const index = schema.findIndex((col) => col.id === id);
    if (
      index === -1 ||
      (direction === "up" && index === 0) ||
      (direction === "down" && index === schema.length - 1)
    ) {
      return;
    }

    const newSchema = [...schema];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newSchema[index] as SchemaColumn;
    newSchema[index] = newSchema[newIndex] as SchemaColumn;
    newSchema[newIndex] = temp;
    onChange(newSchema);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Column Name</TableHead>
              <TableHead className="w-[200px]">Data Type</TableHead>
              <TableHead className="w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schema.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  No columns defined
                </TableCell>
              </TableRow>
            ) : (
              schema.map((column) => (
                <TableRow key={column.id}>
                  <TableCell className="p-2">
                    {editingColumns.has(column.id) ? (
                      <Input
                        className="w-full"
                        value={column.columnName}
                        onChange={(e) =>
                          handleUpdateColumn(column.id, { columnName: e.target.value })
                        }
                      />
                    ) : (
                      <div className="w-full px-3 py-2">{column.columnName}</div>
                    )}
                  </TableCell>
                  <TableCell className="p-2">
                    {editingColumns.has(column.id) ? (
                      <Select
                        value={column.dataType}
                        onValueChange={(value) =>
                          handleUpdateColumn(column.id, {
                            dataType: value as (typeof DATA_TYPES)[number],
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="w-full px-3 py-2">{column.dataType}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toggleEditMode(column.id)}>
                        {editingColumns.has(column.id) ? (
                          <PencilOff className="size-4" />
                        ) : (
                          <Pencil className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={schema.indexOf(column) === 0}
                        onClick={() => handleMoveColumn(column.id, "up")}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={schema.indexOf(column) === schema.length - 1}
                        onClick={() => handleMoveColumn(column.id, "down")}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveColumn(column.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-4">
          <span className="flex shrink-0 items-center text-sm font-medium">Add column:</span>
          <Input
            placeholder="Column name"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
          />
          <Select
            value={newColumnType}
            onValueChange={(value) => setNewColumnType(value as (typeof DATA_TYPES)[number])}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="p-2" onClick={handleAddColumn} size="icon">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {suggestedColumns.length > 0 && (
        <div className="flex flex-row gap-4">
          <div className="flex items-center text-sm font-medium">Suggested columns:</div>
          <div className="flex flex-wrap gap-2">
            {suggestedColumns.map((column) => (
              <Badge
                key={column.columnName}
                variant="secondary"
                className="hover:bg-secondary/80 cursor-pointer"
                onClick={() => {
                  if (!schema.some((col) => col.columnName === column.columnName)) {
                    onChange([
                      ...schema,
                      {
                        id: crypto.randomUUID(),
                        columnName: column.columnName,
                        dataType: column.dataType,
                      },
                    ]);
                  }
                }}
              >
                {column.columnName} ({column.dataType})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
