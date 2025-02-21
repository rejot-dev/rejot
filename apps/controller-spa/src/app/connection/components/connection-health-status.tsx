import { useConnectionHealth } from "@/data/connection/connection-health.data";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ConnectionHealthStatus({
  organizationId,
  connectionSlug,
}: {
  organizationId: string;
  connectionSlug: string;
}) {
  const { data: health, isLoading } = useConnectionHealth(organizationId, connectionSlug);

  if (isLoading) {
    return <Loader2 className="size-4 animate-spin" />;
  }

  return (
    <Badge variant={health?.status === "healthy" ? "secondary" : "destructive"}>
      {health?.status ?? "unknown"}
    </Badge>
  );
}
