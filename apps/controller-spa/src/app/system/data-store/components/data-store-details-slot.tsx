import { Card } from "@/components/ui/card";
import { useDataStore } from "@/data/data-store/data-store.data";
import { Database, Loader2, TableProperties } from "lucide-react";
import { useSelectedSystemSlug } from "../../system.state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface DataStoreDetailsSlotProps {
  dataStoreSlug: string;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <TableProperties className="size-4" />
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading tables...</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function DataStoreDetailsSlot({ dataStoreSlug }: DataStoreDetailsSlotProps) {
  const systemSlug = useSelectedSystemSlug();
  const { data: dataStore, isLoading } = useDataStore(systemSlug, dataStoreSlug);

  const publication = dataStore?.publications.find((p) => p.name === dataStore.publicationName);

  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Data Store Details</h4>
      {!dataStore ? (
        <div className="text-muted-foreground text-sm">Select a data store to see details</div>
      ) : (
        <div className="space-y-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Database className="size-4" />
            <span>{dataStoreSlug}</span>
          </div>
          {isLoading ? (
            <LoadingState />
          ) : (
            <>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <TableProperties className="size-4" />
                <span>
                  {publication?.allTables ? (
                    <Badge>All Tables</Badge>
                  ) : publication?.tables?.length ? (
                    <Badge variant="secondary">Selected Tables</Badge>
                  ) : (
                    <Badge variant="destructive">No Tables</Badge>
                  )}
                </span>
              </div>
              {dataStore.tables.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {dataStore.tables.map((table) => (
                    <div
                      key={`${table.schema}.${table.name}`}
                      className="bg-muted flex items-center gap-2 rounded-md p-2 text-sm"
                    >
                      <TableProperties className="text-muted-foreground size-4" />
                      <span className="truncate">
                        {table.schema}.{table.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
