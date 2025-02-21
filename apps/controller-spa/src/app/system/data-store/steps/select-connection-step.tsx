import { Button } from "@/components/ui/button";
import { ConnectionSelector } from "../../../connection/components/connection-selector";
import type { UseFormReturn } from "react-hook-form";
import type { DataStoreFormValues } from "../data-store.types";
import { ConnectionDetailsSlot } from "@/app/connection/components/connection-details-slot";
import type { Connection } from "@/data/connection/connection.data";
import { useConnectionHealth } from "@/data/connection/connection-health.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Loader2, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";

interface SelectConnectionStepProps {
  form: UseFormReturn<Partial<DataStoreFormValues>>;
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
  const queryClient = useQueryClient();

  const connectionSlug = form.watch("connectionSlug");
  const organizationId = useSelectedOrganizationCode();

  if (!organizationId) {
    throw new Error("Organization ID not found");
  }

  const {
    data: health,
    status,
    isPending,
    isFetching,
  } = useConnectionHealth(organizationId, connectionSlug);
  const isHealthy = health?.status === "healthy";

  const handleRetryHealth = () => {
    queryClient.invalidateQueries({
      queryKey: ["connection-health", organizationId, connectionSlug],
    });
  };

  return (
    <div className="space-y-6">
      <ConnectionSelector
        value={form.watch("connectionSlug")}
        onChange={(value) => {
          form.setValue("connectionSlug", value);
        }}
        connections={connections}
        isLoading={isLoading}
        connectionDetails={(connection) => <ConnectionDetailsSlot connection={connection} />}
      />
      {isPending && isFetching && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>Checking connection health...</AlertDescription>
        </Alert>
      )}
      {status === "success" && !isHealthy && (
        <Alert variant="destructive">
          <AlertTitle>Connection Unhealthy</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              The connection must be healthy before you can continue. Please check your database
              connection settings and the reachability of the database.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryHealth}
              className="ml-4"
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Retry Health Check
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>Failed to check connection health. Please try again.</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onContinue}
          disabled={!form.watch("connectionSlug") || !isHealthy}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
