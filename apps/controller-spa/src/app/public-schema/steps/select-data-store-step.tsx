import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataStoreSelector } from "@/app/system/data-store/components/data-store-selector";
import { useSystemDataStores } from "@/data/data-store/data-store.data";

interface SelectDataStoreStepProps {
  systemSlug: string;
  onSelected: (dataStoreSlug: string) => void;
}

export function SelectDataStoreStep({ systemSlug, onSelected }: SelectDataStoreStepProps) {
  const { data: dataStores, isLoading } = useSystemDataStores(systemSlug);
  const [selectedDataStore, setSelectedDataStore] = useState<string | null>(null);

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
