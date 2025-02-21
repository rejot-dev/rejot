import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { Link } from "react-router";
import { ConnectionSelector } from "@/app/connection/components/connection-selector";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useState } from "react";
import type { Connection } from "@/data/connection/connection.data";
import { ConnectionDetailsSlot } from "@/app/connection/components/connection-details-slot";

interface CreateConnectionStepProps {
  completed?: boolean;
  connections: Connection[];
  isLoading: boolean;
}

export function CreateConnectionStep({
  completed = false,
  connections,
  isLoading,
}: CreateConnectionStepProps) {
  const organizationId = useSelectedOrganizationCode();

  if (!organizationId) {
    return null;
  }

  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  return (
    <Card className={cn("animate-in fade-in slide-in-from-top-2 duration-200")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Connections</CardTitle>
          {completed && (
            <div className="rounded-full bg-green-500/10 p-1">
              <Check className="size-4 text-green-500" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground max-w-prose">
          Connections define how ReJot interacts with your data sources. Currently supporting
          PostgreSQL databases, with more options coming soon.
        </p>
        {completed || (!isLoading && connections.length > 0) ? (
          <>
            <p className="text-muted-foreground max-w-prose">
              Click any of the connections below to view the connection&apos;s state.
            </p>
            <ConnectionSelector
              value={selectedConnection ?? undefined}
              onChange={setSelectedConnection}
              connections={connections}
              isLoading={isLoading}
              showNewConnection={false}
              connectionDetails={(connection) => <ConnectionDetailsSlot connection={connection} />}
            />
          </>
        ) : (
          <></>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button asChild>
          <Link to="/connections/new">
            <Plus className="size-4" />
            Add Connection
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
