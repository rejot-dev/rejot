import { Card } from "@/components/ui/card";

interface ConnectionDetailsSlotProps {
  connection: {
    slug: string;
    config: {
      database: string;
      host: string;
    };
  };
  children?: React.ReactNode;
}

export function ConnectionDetailsSlot({ connection, children }: ConnectionDetailsSlotProps) {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">Connection Details</h4>
      <div className="text-muted-foreground grid gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Host:</span>
          <span>{connection.config.host}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Database:</span>
          <span>{connection.config.database}</span>
        </div>
        {children}
      </div>
    </Card>
  );
}
