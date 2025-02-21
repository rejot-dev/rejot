import { AlertCircle, TableProperties } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TableDetailsSlot } from "./table-details-slot";

interface TableSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  tables?: string[];
  isLoading?: boolean;
  organizationId: string;
  dataStoreSlug: string;
  tableDetails?: (params: {
    organizationId: string;
    dataStoreSlug: string;
    selectedTable?: string;
  }) => React.ReactNode;
  tableDetailsEmpty?: () => React.ReactNode;
}

function TableDetailsSlotEmpty() {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Table Schema</h4>
      <div className="text-muted-foreground text-sm">Select a table to see schema details</div>
    </Card>
  );
}

export function TableSelector({
  value,
  onChange,
  className,
  tables = [],
  isLoading,
  organizationId,
  dataStoreSlug,
  tableDetails = ({ organizationId, dataStoreSlug, selectedTable }) => (
    <TableDetailsSlot
      organizationId={organizationId}
      dataStoreSlug={dataStoreSlug}
      selectedTable={selectedTable}
    />
  ),
  tableDetailsEmpty = () => <TableDetailsSlotEmpty />,
}: TableSelectorProps) {
  if (!tables.length && !isLoading) {
    return (
      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>No tables available</AlertTitle>
        <AlertDescription>
          No tables available in this data store. Please create a publication and add tables to it.
        </AlertDescription>
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
            {[...Array(4)].map((_, index) => (
              <Card key={index} className="relative p-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Skeleton className="mt-1 size-5 shrink-0 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : (
          tables.map((table) => (
            <div key={table} className="relative">
              <RadioGroupItem value={table} id={table} className="sr-only" />
              <label htmlFor={table} className="block cursor-pointer">
                <Card
                  className={cn(
                    "hover:border-primary relative p-4 transition-colors",
                    value === table && "border-primary bg-primary/5",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <TableProperties className="text-primary mt-1 size-5 shrink-0" />
                      <div>
                        <h4 className="text-base font-medium">{table}</h4>
                      </div>
                    </div>
                  </div>
                  {value === table && (
                    <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
                  )}
                </Card>
              </label>
            </div>
          ))
        )}
      </RadioGroup>

      {value && tableDetails({ organizationId, dataStoreSlug, selectedTable: value })}
      {!value && tableDetailsEmpty()}
    </div>
  );
}
