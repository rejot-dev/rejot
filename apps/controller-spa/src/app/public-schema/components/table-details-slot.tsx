import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useConnectionTableSchema } from "@/data/connection/connection-health.data";

interface TableDetailsSlotProps {
  organizationId: string;
  dataStoreSlug: string;
  selectedTable?: string;
}

export function TableDetailsSlot({
  organizationId,
  dataStoreSlug,
  selectedTable,
}: TableDetailsSlotProps) {
  const { data: columns, isLoading: isLoadingSchema } = useConnectionTableSchema(
    organizationId,
    dataStoreSlug,
    selectedTable ?? "",
  );

  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Table Schema</h4>
      {!selectedTable ? (
        <div className="text-muted-foreground text-sm">Select a table to see schema details</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingSchema ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : !columns || columns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No columns found
                  </TableCell>
                </TableRow>
              ) : (
                columns.map((column) => (
                  <TableRow key={column.columnName}>
                    <TableCell>{column.columnName}</TableCell>
                    <TableCell>{column.dataType}</TableCell>
                    <TableCell>
                      <Badge variant={column.isNullable ? "secondary" : "outline"}>
                        {column.isNullable ? "NULL" : "NOT NULL"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {column.columnDefault === null ? (
                        <span className="text-muted-foreground">none</span>
                      ) : (
                        column.columnDefault
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
