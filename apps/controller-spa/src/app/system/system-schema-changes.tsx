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
import { useRecentSchemaChanges } from "@/data/system/system.data";
import { useState } from "react";
import { type SystemOverview } from "@/data/system/system.data";

interface SystemSchemaChangesProps {
  system: SystemOverview;
  organizationId: string;
}

export function SystemSchemaChanges({ system, organizationId }: SystemSchemaChangesProps) {
  const [selectedTable, setSelectedTable] = useState<string>();
  const [selectedSchema, selectedTableName] = selectedTable?.split(".") ?? ["", ""];

  const connectionSlug = system.dataStores.find((ds) =>
    ds.publication.tables?.includes(selectedTableName ?? ""),
  )?.slug;

  const { data: schemaChanges, isLoading: isLoadingChanges } = useRecentSchemaChanges(
    organizationId ?? "",
    connectionSlug ?? "",
    selectedSchema ?? "",
    selectedTableName ?? "",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="w-[300px]">
        <Select value={selectedTable} onValueChange={setSelectedTable}>
          <SelectTrigger>
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent>
            {system.dataStores.map((ds) =>
              (ds.publication.tables || []).map((table) => (
                <SelectItem key={`public.${table}`} value={`public.${table}`}>
                  {`public.${table}`}
                </SelectItem>
              )),
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Schema</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingChanges ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Loading schema changes...
                </TableCell>
              </TableRow>
            ) : !schemaChanges?.changes?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No recent schema changes
                </TableCell>
              </TableRow>
            ) : (
              schemaChanges.changes.map((change, index) => (
                <TableRow key={index}>
                  <TableCell>{selectedSchema}</TableCell>
                  <TableCell>{selectedTableName}</TableCell>
                  <TableCell>{change.details}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
