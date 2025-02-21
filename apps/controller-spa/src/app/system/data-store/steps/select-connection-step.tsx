import { Button } from "@/components/ui/button";
import { ConnectionSelector } from "../../../connection/components/connection-selector";
import type { UseFormReturn } from "react-hook-form";
import type { DataStoreFormValues } from "../data-store.types";
import { ConnectionDetailsSlot } from "@/app/connection/components/connection-details-slot";
import type { Connection } from "@/data/connection/connection.data";

interface SelectConnectionStepProps {
  form: UseFormReturn<DataStoreFormValues>;
  onContinue: () => void;
  connections: Connection[];
  isLoading?: boolean;
}

export function SelectConnectionStep({
  form,
  onContinue,
  connections,
  isLoading,
}: SelectConnectionStepProps) {
  return (
    <div className="space-y-6">
      <ConnectionSelector
        value={form.watch("connectionSlug")}
        onChange={(value) => form.setValue("connectionSlug", value)}
        connections={connections}
        isLoading={isLoading}
        connectionDetails={(connection) => <ConnectionDetailsSlot connection={connection} />}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={onContinue} disabled={!form.watch("connectionSlug")}>
          Continue
        </Button>
      </div>
    </div>
  );
}
