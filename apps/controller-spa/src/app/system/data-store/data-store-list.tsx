import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { PlusCircle, Database, ExternalLink } from "lucide-react";
import { useSystemDataStores } from "@/data/data-store/data-store.data";

interface DataStoreListProps {
  systemSlug: string;
  showNewDataStoreButton?: boolean;
}

export function DataStoreList({ systemSlug, showNewDataStoreButton = true }: DataStoreListProps) {
  const { data: dataStores, isLoading } = useSystemDataStores(systemSlug);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!dataStores?.length) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold tracking-tight">Data Stores</h2>
          <p className="text-muted-foreground text-lg">Manage your data store connections</p>
        </div>
        {showNewDataStoreButton && (
          <Button asChild>
            <Link to={`/systems/${systemSlug}/data-stores/new`} className="gap-2">
              <PlusCircle className="size-4" />
              Create Data Store
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold tracking-tight">Data Stores</h2>
          <p className="text-muted-foreground text-lg">Manage your data store connections</p>
        </div>
        {showNewDataStoreButton && (
          <Button asChild>
            <Link to={`/systems/${systemSlug}/data-stores/new`} className="gap-2">
              <PlusCircle className="size-4" />
              Create Data Store
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connection</TableHead>
              <TableHead>Database</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataStores.map((dataStore) => (
              <TableRow key={dataStore.slug}>
                <TableCell>{dataStore.slug}</TableCell>
                <TableCell>{dataStore.connectionConfig.database}</TableCell>
                <TableCell>{dataStore.connectionConfig.host}</TableCell>
                <TableCell className="capitalize">{dataStore.connectionConfig.type}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" asChild>
                      <Link to={`/systems/${systemSlug}/data-stores/${dataStore.slug}`}>
                        <ExternalLink className="size-4" />
                        View Details
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link to={`/systems/${systemSlug}/data-stores/${dataStore.slug}/tables`}>
                        <Database className="size-4" />
                        Show Database Diagram
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
