import { useConnectionPublications } from "@/data/connection/connection-health.data";
import {
  type ConnectionPublication,
  type ConnectionTable,
} from "@rejot/api-interface-controller/connection-health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
interface PostgresPublicationDetailsProps {
  organizationId: string;
  connectionSlug: string;
}

export function PostgresPublicationDetails({
  organizationId,
  connectionSlug,
}: PostgresPublicationDetailsProps) {
  const {
    data: publications,
    isLoading,
    error,
  } = useConnectionPublications(organizationId, connectionSlug);

  // TODO Move this component to different folder.

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Postgres Publications</CardTitle>
          <CardDescription>Loading publication details...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Postgres Publications</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load publications
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!publications?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Postgres Publications</CardTitle>
          <CardDescription>No publications found for this connection</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Postgres Publications</CardTitle>
        <CardDescription>Active publications in the database</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Publication Name</TableHead>
              <TableHead>Configuration</TableHead>
              <TableHead>Tables</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publications.map((publication: ConnectionPublication) => (
              <TableRow key={publication.name}>
                <TableCell className="font-medium">{publication.name}</TableCell>
                <TableCell>
                  {publication.allTables ? (
                    <Badge>All Tables</Badge>
                  ) : publication.tables?.length ? (
                    <Badge variant="secondary">Selected Tables</Badge>
                  ) : (
                    <Badge variant="destructive">No Tables</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {publication.allTables ? (
                    <span className="text-muted-foreground">N/A</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {publication.tables?.length ? (
                        publication.tables.map((table: ConnectionTable) => (
                          <Badge key={`${table.schema}.${table.name}`} variant="outline">
                            {table.schema !== "public" && table.schema
                              ? `${table.schema}.${table.name}`
                              : table.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No tables selected</span>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
