import { NavLink, useParams, Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDataStore } from "@/data/data-store/data-store.data";
import { useSelectedSystemSlug } from "@/app/system/system.state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LockOpen, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PostgresPublicationDetails } from "@/app/connection/components/postgres-publication-details";
import { useStartSyncMutation } from "@/data/sync-service/sync-service.data";
import { useUser } from "@clerk/clerk-react";

export function DataStoreDetail() {
  const { dataStoreSlug } = useParams();
  const systemSlug = useSelectedSystemSlug();
  const { data: dataStore, isLoading } = useDataStore(systemSlug, dataStoreSlug ?? null);
  const { user } = useUser();
  const startSyncMutation = useStartSyncMutation();

  const isRejotUser = user?.emailAddresses[0]?.emailAddress?.endsWith("@rejot.dev") ?? false;

  if (!systemSlug || !dataStoreSlug) {
    return null;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!dataStore) {
    return <div>Data store not found</div>;
  }

  const handleSync = () => {
    startSyncMutation.mutate({
      systemSlug,
      dataStoreSlug,
    });
  };

  const getSyncStatusText = () => {
    if (startSyncMutation.isError) {
      return <span className="text-destructive">Sync failed</span>;
    }
    if (startSyncMutation.isSuccess) {
      return <span className="text-muted-foreground">Last sync completed successfully</span>;
    }
    return null;
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to="/">Home</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to={`/systems/${systemSlug}/data-stores`}>Data Stores</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{dataStore.slug}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{dataStore.slug}</h1>
            <Badge variant="outline" className="gap-2">
              <LockOpen className="size-4" />
              Insecure
            </Badge>
            {isRejotUser && (
              <>
                <div className="ml-auto text-sm">{getSyncStatusText()}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={startSyncMutation.isPending}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`size-4 ${startSyncMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {startSyncMutation.isPending ? "Syncing..." : "Sync Now"}
                </Button>
              </>
            )}
          </div>
          <p className="text-muted-foreground text-lg">Data store details and configuration</p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Connection Details</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link to={`/connections/${dataStore.slug}`}>
                  <ExternalLink className="size-4" />
                  View Connection
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Connection ID</div>
                <div className="font-medium">{dataStore.slug}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Host</div>
                  <div>{dataStore.connectionConfig.host}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Database</div>
                  <div>{dataStore.connectionConfig.database}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <PostgresPublicationDetails
          organizationId={dataStore.organization.id}
          connectionSlug={dataStore.slug}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Tables</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link to={`/systems/${systemSlug}/data-stores/${dataStore.slug}/tables`}>
                  <ExternalLink className="size-4" />
                  View Diagram
                </Link>
              </Button>
            </div>
            <CardDescription>Available database tables</CardDescription>
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
                {dataStore.tables.map((table) => (
                  <TableRow key={`${table.schema}.${table.name}`}>
                    <TableCell>{table.schema}</TableCell>
                    <TableCell>{table.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
