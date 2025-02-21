import { Card } from "@/components/ui/card";
import type { Connection } from "@/data/connection/connection.data";
import { ConnectionHealthStatus } from "./connection-health-status";

interface ConnectionDetailsSlotProps {
  connection: Connection;
}

export function ConnectionDetailsSlot({ connection }: ConnectionDetailsSlotProps) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">Connection Details</h4>
        <div className="flex items-center gap-2">
          <ConnectionHealthStatus connectionSlug={connection.slug} />
        </div>
      </div>
      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Type:</span>
          <span className="capitalize">{connection.config.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Name:</span>
          <span>{connection.slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Host:</span>
          <span>{connection.config.host}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Port:</span>
          <span>{connection.config.port}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Database:</span>
          <span>{connection.config.database}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">User:</span>
          <span>{connection.config.user}</span>
        </div>
      </div>
    </Card>
  );
}
