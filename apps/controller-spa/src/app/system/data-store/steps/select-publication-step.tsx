import { Button } from "@/components/ui/button";
import { PublicationSelector } from "../publication-selector";
import type { UseFormReturn } from "react-hook-form";
import type { DataStoreFormValues } from "../data-store.types";

interface SelectPublicationStepProps {
  form: UseFormReturn<DataStoreFormValues>;
  organizationId: string;
  onBack: () => void;
}

export function SelectPublicationStep({
  form,
  organizationId,
  onBack,
}: SelectPublicationStepProps) {
  return (
    <div className="space-y-6">
      <PublicationSelector form={form} organizationId={organizationId} />
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Add Data Store</Button>
      </div>
    </div>
  );
}
