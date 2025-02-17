import { useConnectionPublications } from "@/data/connection/connection-health.data";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { UseFormReturn } from "react-hook-form";
import type { DataStoreFormValues } from "./data-store.types";
import { AlertCircle, Database, Table as TableIcon, TableProperties } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConnectionTable } from "@rejot/api-interface-controller/connection-health";

interface PublicationSelectorProps {
  form: UseFormReturn<DataStoreFormValues>;
  organizationId: string;
}

export function PublicationSelector({ form, organizationId }: PublicationSelectorProps) {
  const connectionSlug = form.watch("connectionSlug");
  const {
    data: publications = [],
    error,
    isLoading,
  } = useConnectionPublications(organizationId, connectionSlug);
  const selectedPublication = publications.find((p) => p.name === form.watch("publicationName"));

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load publications</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="publicationName"
        render={({ field }) => (
          <FormItem className="space-y-4">
            <FormLabel>Publication</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {isLoading ? (
                  <>
                    {[...Array(3)].map((_, index) => (
                      <Card key={index} className="relative p-4">
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <Skeleton className="mt-1 h-5 w-5 shrink-0 rounded" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-5 w-3/4" />
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-20" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </>
                ) : (
                  publications.map((publication) => (
                    <div key={publication.name} className="relative">
                      <RadioGroupItem
                        value={publication.name}
                        id={publication.name}
                        className="sr-only"
                      />
                      <label htmlFor={publication.name} className="block cursor-pointer">
                        <Card
                          className={cn(
                            "hover:border-primary relative p-4 transition-colors",
                            field.value === publication.name && "border-primary bg-primary/5",
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <Database className="text-primary mt-1 h-5 w-5 shrink-0" />
                              <div>
                                <h4 className="text-base font-medium">{publication.name}</h4>
                                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                                  <TableProperties className="h-4 w-4" />
                                  {publication.allTables ? (
                                    <span>All Tables</span>
                                  ) : (
                                    <span>{publication.tables?.length || 0} Tables</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {field.value === publication.name && (
                            <div className="bg-primary absolute right-4 top-4 h-2 w-2 rounded-full" />
                          )}
                        </Card>
                      </label>
                    </div>
                  ))
                )}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      <Card className="p-4">
        <h4 className="mb-3 text-sm font-medium">Included Tables</h4>
        {!selectedPublication ? (
          <div className="text-muted-foreground text-sm">
            Select a publication to see included tables
          </div>
        ) : selectedPublication.allTables ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <TableIcon className="h-4 w-4" />
            <span>All tables in the database will be included</span>
          </div>
        ) : !selectedPublication.tables?.length ? (
          <div className="text-muted-foreground text-sm">
            No tables included in this publication
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {selectedPublication.tables.map((table: ConnectionTable) => (
              <div
                key={`${table.schema}.${table.name}`}
                className="bg-muted flex items-center gap-2 rounded-md p-2 text-sm"
              >
                <TableIcon className="text-muted-foreground h-4 w-4" />
                <span className="truncate">
                  {table.schema}.{table.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
