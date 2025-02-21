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
  const connectionSlug = form.watch("connectionSlug");
  const publicationName = form.watch("publicationName");

  return (
    <div className="space-y-6">
      <PublicationSelector
        value={publicationName}
        onChange={(value) => form.setValue("publicationName", value)}
        connectionSlug={connectionSlug}
        organizationId={organizationId}
      />
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Create Data Store</Button>
      </div>
    </div>
  );
}
