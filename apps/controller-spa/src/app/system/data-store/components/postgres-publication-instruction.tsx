import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPostgresConnectionString } from "@/data/connection/connection-string";
import type { Connection } from "@/data/connection/connection.data";
import { BookOpen } from "lucide-react";

interface PublicationStepProps {
  stepNumber: number;
  title: string;
  description: string;
  code?: string;
}

function PublicationStep({ stepNumber, title, description, code }: PublicationStepProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-full bg-blue-500/10 text-sm font-medium text-blue-500">
          {stepNumber}
        </div>
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
      {code && (
        <pre className="bg-muted/50 mt-2 rounded-md p-4">
          <code className="text-sm">{code}</code>
        </pre>
      )}
    </div>
  );
}

interface PostgresPublicationInstructionProps {
  connection: Connection;
  showRealInstructions?: boolean;
}

export function PostgresPublicationInstruction({
  connection,
  showRealInstructions = true,
}: PostgresPublicationInstructionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="text-primary size-5" />
          <CardTitle className="text-lg">Creating a PostgreSQL Publication</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTitle>Enable Logical Replication</AlertTitle>
          <AlertDescription className="text-sm">
            Make sure you have the necessary permissions to create publications and that logical
            replication is enabled in your postgresql.conf file (wal_level = logical).
          </AlertDescription>
        </Alert>

        <p className="text-muted-foreground text-sm">
          Before you can synchronize data, you need to create a publication in your PostgreSQL
          database.
        </p>

        {showRealInstructions ? (
          <>
            <PublicationStep
              stepNumber={1}
              title="Connect to Your Database"
              description="First, connect to your PostgreSQL database using psql or your preferred database client.
          You can also use your database provider's web interface to connect to your database."
              code={`psql ${getPostgresConnectionString(connection)}`}
            />

            <PublicationStep
              stepNumber={2}
              title="Create the Publication"
              description="Create a publication for the tables you want to synchronize. You can create a publication for all tables or specific ones."
              code={`-- For all tables:
CREATE PUBLICATION rejot_publication FOR ALL TABLES;

-- For specific tables:
CREATE PUBLICATION rejot_publication FOR TABLE table1, table2;`}
            />

            <PublicationStep
              stepNumber={3}
              title="Verify the Publication"
              description="Check that your publication was created correctly and includes the expected tables.
The next step in this wizard will show the created publications(s)."
              code={`-- List all publications:
SELECT pubname, puballtables FROM pg_publication;`}
            />
          </>
        ) : (
          <PublicationStep
            stepNumber={0}
            title="Skip this step"
            description="You don't currently have access to the sync functionality, 
            so we're skipping the creation of a publication for now."
            code={`psql ${getPostgresConnectionString(connection)}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
