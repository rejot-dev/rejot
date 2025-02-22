import { AlertCircle, Database, TableProperties } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SystemOverview } from "@/data/system/system.data";
import { DataStoreDetailsSlot } from "./data-store-details-slot";

interface DataStoreSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  dataStores: SystemOverview["dataStores"];
  isLoading?: boolean;
  dataStoreDetails?: (dataStore: SystemOverview["dataStores"][number]) => React.ReactNode;
  dataStoreDetailsEmpty?: () => React.ReactNode;
}

function DataStoreDetailsSlotEmpty() {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Data Store Details</h4>
      <div className="text-muted-foreground text-sm">Select a data store to see details</div>
    </Card>
  );
}

export function DataStoreSelector({
  value,
  onChange,
  className,
  dataStores,
  isLoading,
  dataStoreDetails = (dataStore) => <DataStoreDetailsSlot dataStore={dataStore} />,
  dataStoreDetailsEmpty = () => <DataStoreDetailsSlotEmpty />,
}: DataStoreSelectorProps) {
  const selectedDataStore = value ? dataStores.find((ds) => ds.slug === value) : undefined;

  if (!dataStores.length) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>No data stores available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {isLoading ? (
          <>
            {[...Array(3)].map((_, index) => (
              <Card key={index} className="relative p-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Skeleton className="mt-1 size-5 shrink-0 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-4" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : (
          dataStores.map((dataStore) => (
            <div key={dataStore.slug} className="relative">
              <RadioGroupItem value={dataStore.slug} id={dataStore.slug} className="sr-only" />
              <label htmlFor={dataStore.slug} className="block cursor-pointer">
                <Card
                  className={cn(
                    "hover:border-primary relative p-4 transition-colors",
                    value === dataStore.slug && "border-primary bg-primary/5",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Database className="text-primary mt-1 size-5 shrink-0" />
                      <div>
                        <h4 className="text-base font-medium">{dataStore.slug}</h4>
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                          <TableProperties className="size-4" />
                          <span>{dataStore.tables.length} Tables</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {value === dataStore.slug && (
                    <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
                  )}
                </Card>
              </label>
            </div>
          ))
        )}
      </RadioGroup>

      {selectedDataStore && dataStoreDetails(selectedDataStore)}
      {!selectedDataStore && dataStoreDetailsEmpty()}
    </div>
  );
}
