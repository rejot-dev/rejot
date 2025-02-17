import { useParams } from "react-router";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useConnections } from "@/data/connection/connection.data";
import { ConnectionHeader } from "./components/connection-header";
import { ConnectionConfigForm } from "./components/connection-config-form";
import { ConnectionTables } from "./components/connection-tables";
import { PostgresPublicationDetails } from "./components/postgres-publication-details";

export function ConnectionDetail() {
  const { connectionSlug } = useParams();
  const organizationId = useSelectedOrganizationCode();
  const { data: connections } = useConnections(organizationId ?? "");
  const connection = connections?.find((c) => c.slug === connectionSlug);

  if (!connectionSlug || !organizationId) {
    return null;
  }

  if (!connection) {
    return <div>Connection not found</div>;
  }

  return (
    <>
      <ConnectionHeader connectionSlug={connectionSlug} />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">{connection.slug}</h1>
          <p className="text-lg text-muted-foreground">Connection details and database tables</p>
        </div>

        <div className="grid gap-6">
          <ConnectionConfigForm connection={connection} />
          {connection.type === "postgres" && (
            <PostgresPublicationDetails
              organizationId={organizationId}
              connectionSlug={connectionSlug}
            />
          )}
          <ConnectionTables organizationId={organizationId} connectionSlug={connectionSlug} />
        </div>
      </div>
    </>
  );
}
