import { Loader2 } from "lucide-react";
import { DataStoreSelector } from "@/app/system/data-store/components/data-store-selector";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePublicSchemas } from "@/data/public-schema/public-schema.data";
import { useSelectedSystemSlug } from "@/app/system/system.state";
import { useSystemDataStores } from "@/data/data-store/data-store.data";

interface SelectDataStoreStepProps {
  onSelected: (dataStoreSlug: string) => void;
}

function PublicSchemaDetailsSlot() {
  const systemSlug = useSelectedSystemSlug();
  const { data: publicSchemas, isLoading } = usePublicSchemas(systemSlug);

  if (isLoading) {
    return (
      <Card className="p-4">
        <h4 className="mb-3 text-sm font-medium">Public Schemas</h4>
        <div className="flex justify-center p-4">
          <Loader2 className="size-4 animate-spin" />
        </div>
      </Card>
    );
  }

  if (!publicSchemas?.length) {
    return (
      <Card className="p-4">
        <h4 className="mb-3 text-sm font-medium">Public Schemas</h4>
        <div className="text-muted-foreground text-sm">No public schemas available</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Public Schemas</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {publicSchemas.map((schema) => (
          <div key={schema.id} className="bg-muted flex items-center gap-2 rounded-md p-2 text-sm">
            <span className="truncate">{schema.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SelectDataStoreStep({ onSelected }: SelectDataStoreStepProps) {
  const systemSlug = useSelectedSystemSlug();
  const [selectedDataStore, setSelectedDataStore] = useState<string | null>(null);

  if (!systemSlug) {
    return null;
  }

  const { data: dataStores, isLoading } = useSystemDataStores(systemSlug);

  if (isLoading || !dataStores) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!dataStores.length) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        No data stores available. Please create a data store first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DataStoreSelector
        value={selectedDataStore ?? undefined}
        dataStores={dataStores.map((ds) => ({
          slug: ds.slug,
          name: ds.publicationName,
          database: ds.connectionConfig.database,
          host: ds.connectionConfig.host,
        }))}
        isLoading={isLoading}
        onChange={(value) => {
          setSelectedDataStore(value);
        }}
        dataStoreDetails={(_dataStore) => <PublicSchemaDetailsSlot />}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            onSelected(selectedDataStore!);
          }}
          disabled={!selectedDataStore}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
