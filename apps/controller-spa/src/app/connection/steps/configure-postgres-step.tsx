import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useCreateConnectionMutation } from "@/data/connection/connection.data";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { useCheckConnectionMutation } from "@/data/connection/connection-raw.data";
import { Badge } from "@/components/ui/badge";
import {
  ConnectionNewPostgresForm,
  type ConnectionNewPostgresFormData,
} from "../connection-new-postgres.form";
import { useState } from "react";
import { FetchError } from "@/data/fetch";

interface ConfigurePostgresStepProps {
  onBack: () => void;
  onConfigured: (config: ConnectionNewPostgresFormData) => void;
}

export function ConfigurePostgresStep({ onBack, onConfigured }: ConfigurePostgresStepProps) {
  const organizationId = useSelectedOrganizationCode();
  const createMutation = useCreateConnectionMutation();
  const checkHealthMutation = useCheckConnectionMutation();
  const [lastCheckedConfig, setLastCheckedConfig] = useState<ConnectionNewPostgresFormData>();

  async function onSubmit(values: ConnectionNewPostgresFormData) {
    if (!organizationId) {
      return;
    }

    setLastCheckedConfig(values);
    await checkHealthMutation.mutateAsync(values);
  }

  async function handleCreate() {
    if (!organizationId || !isHealthy || !lastCheckedConfig) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        organizationId,
        data: {
          slug: lastCheckedConfig.slug,
          config: {
            type: lastCheckedConfig.type,
            host: lastCheckedConfig.host,
            port: lastCheckedConfig.port,
            user: lastCheckedConfig.user,
            password: lastCheckedConfig.password,
            database: lastCheckedConfig.database,
            ssl: lastCheckedConfig.ssl,
          },
        },
      });
      onConfigured(lastCheckedConfig);
    } catch (_error) {
      // Error will be shown in the alert
    }
  }

  const isHealthy =
    checkHealthMutation.data?.status === "success" &&
    checkHealthMutation.data.data.status === "healthy";

  const healthMessage =
    checkHealthMutation.data?.status === "success"
      ? checkHealthMutation.data.data.message
      : checkHealthMutation.data?.message;

  if (!organizationId) {
    return null;
  }

  return (
    <div className="space-y-6">
      {checkHealthMutation.isPending && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>Checking connection health...</AlertDescription>
        </Alert>
      )}
      {!checkHealthMutation.isPending && checkHealthMutation.data && !isHealthy && (
        <Alert variant="destructive">
          <AlertTitle>Connection Unhealthy</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              The connection must be healthy before you can continue. Please check your database
              connection settings and the reachability of the database.
            </p>
            <p className="text-sm font-medium">
              {healthMessage ? (
                <>Message from server: {healthMessage}</>
              ) : (
                <>No further details were provided by the server.</>
              )}
            </p>
          </AlertDescription>
        </Alert>
      )}
      {createMutation.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {createMutation.error instanceof FetchError
              ? createMutation.error.message
              : "An unexpected error occurred while creating the connection"}
          </AlertDescription>
        </Alert>
      )}

      <ConnectionNewPostgresForm
        id="postgres-connection-form"
        organizationId={organizationId}
        onSubmit={onSubmit}
        isSubmitting={checkHealthMutation.isPending}
        formControls={({ isSubmitting }) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={isHealthy ? "secondary" : "destructive"} className="capitalize">
                {checkHealthMutation.isPending
                  ? "Checking..."
                  : checkHealthMutation.data
                    ? isHealthy
                      ? "Healthy"
                      : "Unhealthy"
                    : "Not Checked"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" variant="secondary" disabled={isSubmitting}>
                {checkHealthMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Checking Health...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 size-4" />
                    Check Connection
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!isHealthy || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Connection"}
              </Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
