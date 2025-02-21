import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SystemOverview } from "@/data/system/system.data";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { PlusCircle } from "lucide-react";

interface DataStoreListProps {
  systemOverview: SystemOverview;
}

export function DataStoreList({ systemOverview }: DataStoreListProps) {
  const systemSlug = systemOverview.slug;

  if (!systemOverview.dataStores.length) {
    return (
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Data Stores</h2>
        <Button asChild>
          <Link to={`/systems/${systemSlug}/data-stores/new`} className="gap-2">
            <PlusCircle className="size-4" />
            New Data Store
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Data Stores</h2>
        <Button asChild>
          <Link to={`/systems/${systemSlug}/data-stores/new`} className="gap-2">
            <PlusCircle className="size-4" />
            New Data Store
          </Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Publication</TableHead>
            <TableHead className="w-40">Connection</TableHead>
            <TableHead>Tables</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {systemOverview.dataStores.map((dataStore) => (
            <TableRow key={dataStore.slug}>
              <TableCell className="font-medium">{dataStore.publication.name}</TableCell>
              <TableCell>
                <Link
                  to={`/connections/${dataStore.slug}`}
                  className="text-primary hover:underline"
                >
                  {dataStore.slug}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {dataStore.publication.tables?.length ? (
                    dataStore.publication.tables.map((table) => (
                      <Link
                        key={table}
                        to={`/connections/${dataStore.slug}/tables/${table}`}
                        className="transition-colors"
                      >
                        <Badge
                          variant="outline"
                          className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                        >
                          {table}
                        </Badge>
                      </Link>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No tables specified.</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
