import { Button } from "@/components/ui/button";
import type { Connection } from "../data-store.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, DatabaseIcon, Loader2 } from "lucide-react";
import { useConnectionHealth } from "@/data/connection/connection-health.data";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Checking connection health...</AlertDescription>
        </Alert>
      )}
      {!isLoading && !isHealthy && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The connection must be healthy before you can continue. Please check your connection
            settings.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Connection Details</CardTitle>
            <DatabaseIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <div className="grid gap-4 text-sm">
              <div className="space-y-1 col-span-2">
                <div className="text-muted-foreground">Connection ID</div>
                <div className="font-medium">{connection.slug}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Host</div>
                <div>{connection.config.host}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Port</div>
                <div>{connection.config.port}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Database</div>
                <div>{connection.config.database}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Username</div>
                <div>{connection.config.user}</div>
              </div>
              <div className="space-y-1 col-span-2 pt-2">
                <div className="text-muted-foreground">Connection Status</div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      isLoading
                        ? "outline"
                        : health?.status === "healthy"
                          ? "secondary"
                          : "destructive"
                    }
                    className="capitalize"
                  >
                    {isLoading ? "checking" : (health?.status ?? "unknown")}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
