import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useCreateConnectionMutation } from "@/data/connection/connection.data";
import { Button } from "@/components/ui/button";
import {
  ConnectionNewPostgresForm,
  type ConnectionNewPostgresFormData,
} from "../connection-new-postgres.form";

interface ConfigurePostgresStepProps {
  onBack: () => void;
  onConfigured: (config: ConnectionNewPostgresFormData) => void;
}

export function ConfigurePostgresStep({ onBack, onConfigured }: ConfigurePostgresStepProps) {
  const organizationId = useSelectedOrganizationCode();
  const createMutation = useCreateConnectionMutation();

  async function onSubmit(values: ConnectionNewPostgresFormData) {
    if (!organizationId) {
      return;
    }

    onConfigured(values);
  }

  if (!organizationId) {
    return null;
  }

  return (
    <ConnectionNewPostgresForm
      id="postgres-connection-form"
      organizationId={organizationId}
      onSubmit={onSubmit}
      isSubmitting={createMutation.isPending}
      formControls={({ isSubmitting }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting} form="postgres-connection-form">
            {isSubmitting ? "Validating..." : "Next"}
          </Button>
        </div>
      )}
    />
  );
}
