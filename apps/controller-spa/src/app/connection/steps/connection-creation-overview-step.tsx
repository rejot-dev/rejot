import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { useCheckConnectionHealth } from "@/data/connection/connection-raw.data";
import { ConnectionDetailsCard } from "../components/connection-details-card";
import { useCreateConnectionMutation } from "@/data/connection/connection.data";
import { useQueryClient } from "@tanstack/react-query";
import { FetchError } from "@/data/fetch";

interface ConnectionCreationOverviewStepProps {
  connection: {
    slug: string;
    config: {
      type: "postgres";
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    };
  };
  organizationId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function ConnectionCreationOverviewStep({
  connection,
  organizationId,
  onBack,
  onSuccess,
}: ConnectionCreationOverviewStepProps) {
  const queryClient = useQueryClient();
  const {
    data: healthResult,
    isLoading: isHealthChecking,
    isFetching,
  } = useCheckConnectionHealth(connection.config);
  const createConnectionMutation = useCreateConnectionMutation();
  const isHealthy = healthResult?.status === "success" && healthResult.data.status === "healthy";

  const handleRetryHealth = () => {
    queryClient.invalidateQueries({ queryKey: ["connection-health", connection.config] });
  };

  const handleContinue = async () => {
    try {
      await createConnectionMutation.mutateAsync({
        organizationId,
        data: connection,
      });

      onSuccess();
    } catch (_error) {
      // Error will be shown in the alert below
    }
  };

  return (
    <div className="space-y-6">
      {isHealthChecking && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>Checking connection health...</AlertDescription>
        </Alert>
      )}
      {!isHealthChecking && !isHealthy && (
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
      {createConnectionMutation.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {createConnectionMutation.error instanceof FetchError
              ? createConnectionMutation.error.message
              : "An unexpected error occurred while creating the connection"}
          </AlertDescription>
        </Alert>
      )}

      <ConnectionDetailsCard
        connection={connection}
        status={isHealthChecking ? "checking" : isHealthy ? "healthy" : "unhealthy"}
      />

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={createConnectionMutation.isPending}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={isHealthChecking || !isHealthy || createConnectionMutation.isPending}
        >
          {createConnectionMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}
