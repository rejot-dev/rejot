import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatabaseIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ConnectionDetailsCardProps {
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
  status: "healthy" | "unhealthy" | "checking" | "unknown";
}

export function ConnectionDetailsCard({ connection, status }: ConnectionDetailsCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Connection Details</CardTitle>
          <DatabaseIcon className="text-muted-foreground size-5" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="grid gap-4 text-sm">
            <div className="col-span-2 space-y-1">
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
            <div className="col-span-2 space-y-1 pt-2">
              <div className="text-muted-foreground">Connection Status</div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    status === "checking"
                      ? "outline"
                      : status === "healthy"
                        ? "secondary"
                        : "destructive"
                  }
                  className="capitalize"
                >
                  {status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
