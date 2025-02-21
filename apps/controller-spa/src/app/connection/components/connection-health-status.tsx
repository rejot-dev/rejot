import { useConnectionHealth } from "@/data/connection/connection-health.data";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";

export function ConnectionHealthStatus({ connectionSlug }: { connectionSlug: string }) {
  const organizationId = useSelectedOrganizationCode();

  if (!organizationId) {
    return null;
  }

  const { data: health, isLoading } = useConnectionHealth(organizationId, connectionSlug);

  if (isLoading) {
    return <Loader2 className="size-4 animate-spin" />;
  }

  return (
    <Badge
      className="capitalize"
      variant={health?.status === "healthy" ? "secondary" : "destructive"}
    >
      {health?.status ?? "unknown"}
    </Badge>
  );
}
