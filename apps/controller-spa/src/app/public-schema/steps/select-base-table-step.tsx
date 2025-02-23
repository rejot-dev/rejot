import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { TableSelector } from "../components/table-selector";
import { useDataStore } from "@/data/data-store/data-store.data";

interface SelectBaseTableStepProps {
  systemSlug: string;
  dataStoreSlug: string;
  onBack: () => void;
  onSelected: (table: string) => void;
}

export function SelectBaseTableStep({
  systemSlug,
  dataStoreSlug,
  onBack,
  onSelected,
}: SelectBaseTableStepProps) {
  const organizationId = useSelectedOrganizationCode();

  if (!organizationId) {
    return null;
  }
  const { data: dataStore, isLoading } = useDataStore(systemSlug, dataStoreSlug);

  const [selectedTable, setSelectedTable] = useState<string>();

  if (isLoading || !dataStore) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TableSelector
        value={selectedTable}
        onChange={setSelectedTable}
        tables={dataStore.tables.map((table) => `${table.schema}.${table.name}`)}
        organizationId={organizationId}
        dataStoreSlug={dataStoreSlug}
      />

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() => selectedTable && onSelected(selectedTable)}
          disabled={!selectedTable}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
