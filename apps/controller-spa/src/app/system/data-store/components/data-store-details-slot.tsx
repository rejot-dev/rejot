import { Card } from "@/components/ui/card";
import { Database, TableProperties } from "lucide-react";
import type { SystemOverview } from "@/data/system/system.data";

interface DataStoreDetailsSlotProps {
  dataStore: SystemOverview["dataStores"][number];
}

export function DataStoreDetailsSlot({ dataStore }: DataStoreDetailsSlotProps) {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Data Store Details</h4>
      {!dataStore ? (
        <div className="text-muted-foreground text-sm">Select a data store to see details</div>
      ) : (
        <div className="space-y-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Database className="size-4" />
            <span>{dataStore.slug}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <TableProperties className="size-4" />
            <span>{dataStore.tables.length} Tables</span>
          </div>
          {dataStore.tables && dataStore.tables.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dataStore.tables.map((table) => (
                <div
                  key={table}
                  className="bg-muted flex items-center gap-2 rounded-md p-2 text-sm"
                >
                  <TableProperties className="text-muted-foreground size-4" />
                  <span className="truncate">{table}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
