import { useSystemOverview } from "@/data/system/system.data";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { TableSelector } from "../components/table-selector";

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

  const { data: systemOverview, isLoading: isLoadingSystem } = useSystemOverview(systemSlug);
  const [selectedTable, setSelectedTable] = useState<string>();

  const dataStore = systemOverview?.dataStores.find((ds) => ds.slug === dataStoreSlug);

  if (isLoadingSystem || !systemOverview || !dataStore) {
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
        tables={dataStore.publication.tables}
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
