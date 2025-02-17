import { NavLink } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useConnectionTables } from "@/data/connection/connection-health.data";

interface ConnectionTablesProps {
  organizationId: string;
  connectionSlug: string;
}

export function ConnectionTables({ organizationId, connectionSlug }: ConnectionTablesProps) {
  const { data: tables, isLoading } = useConnectionTables(organizationId, connectionSlug);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Tables</CardTitle>
        <CardDescription>Available tables in your database</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Schema</TableHead>
              <TableHead>Table Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : !tables || tables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center">
                  No tables found
                </TableCell>
              </TableRow>
            ) : (
              tables.map((table) => (
                <TableRow key={`${table.schema}.${table.name}`}>
                  <TableCell>{table.schema}</TableCell>
                  <TableCell>
                    <NavLink
                      to={`/connections/${connectionSlug}/tables/${table.schema}.${table.name}`}
                      className="hover:underline"
                    >
                      {table.name}
                    </NavLink>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
