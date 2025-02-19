import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useCreateConnectionMutation } from "@/data/connection/connection.data";
import {
  ConnectionNewPostgresForm,
  type ConnectionNewPostgresFormData,
} from "./connection-new-postgres.form";
import { Button } from "@/components/ui/button";

export function ConnectionNewPostgres() {
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
    <div className="mx-auto min-w-96 max-w-prose space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New PostgreSQL Connection</h1>
      </div>

      <ConnectionNewPostgresForm
        id="postgres-connection-form"
        organizationId={organizationId}
        onSubmit={onSubmit}
        isSubmitting={createMutation.isPending}
        formControls={({ isSubmitting }) => (
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/connections/new")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} form="postgres-connection-form">
              {isSubmitting ? "Creating..." : "Create Connection"}
            </Button>
          </div>
        )}
      />
    </div>
  );
}
