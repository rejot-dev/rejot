import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { useConnectionHealth } from "@/data/connection/connection-health.data";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectionDetailsSlot } from "@/app/connection/components/connection-details-slot";
import type { Connection } from "@/data/connection/connection.data";
import { PostgresPublicationInstruction } from "../components/postgres-publication-instruction";

interface ConnectionOverviewStepProps {
  organizationId: string;
  connection: Connection;
  onBack: () => void;
  onContinue: () => void;
}

export function ConnectionOverviewStep({
  organizationId,
  connection,
  onBack,
  onContinue,
}: ConnectionOverviewStepProps) {
  const { data: health, isLoading } = useConnectionHealth(organizationId, connection.slug);
  const isHealthy = health?.status === "healthy";

  return (
    <div className="space-y-6">
      {isLoading && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>Checking connection health...</AlertDescription>
        </Alert>
      )}
      {!isLoading && !isHealthy && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            The connection must be healthy before you can continue. Please check your connection
            settings.
          </AlertDescription>
        </Alert>
      )}
      <ConnectionDetailsSlot connection={connection} />

      <PostgresPublicationInstruction connection={connection} />

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue} disabled={isLoading || !isHealthy}>
          Continue
        </Button>
      </div>
    </div>
  );
}
