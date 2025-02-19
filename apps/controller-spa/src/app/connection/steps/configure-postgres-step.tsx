import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useCreateConnectionMutation } from "@/data/connection/connection.data";
import { Button } from "@/components/ui/button";
import {
  ConnectionNewPostgresForm,
  type ConnectionNewPostgresFormData,
} from "../connection-new-postgres.form";

interface ConfigurePostgresStepProps {
  onBack: () => void;
}

export function ConfigurePostgresStep({ onBack }: ConfigurePostgresStepProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizationId = useSelectedOrganizationCode();
  const createMutation = useCreateConnectionMutation();

  async function onSubmit(values: ConnectionNewPostgresFormData) {
    if (!organizationId) return;

    const result = await createMutation.mutateAsync({
      organizationId,
      data: {
        slug: values.slug,
        config: {
          type: "postgres",
          host: values.host,
          port: values.port,
          database: values.database,
          user: values.user,
          password: values.password,
        },
      },
    });

    if (result.status === "success") {
      await queryClient.invalidateQueries({ queryKey: ["connections"] });
      navigate("/connections");
    }
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
            {isSubmitting ? "Creating..." : "Create Connection"}
          </Button>
        </div>
      )}
    />
  );
}
