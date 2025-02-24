import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReadonlyUserStepProps {
  stepNumber: number;
  title: string;
  description: string;
  code?: string;
}

function ReadonlyUserStep({ stepNumber, title, description, code }: ReadonlyUserStepProps) {
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

interface PostgresReadonlyUserInstructionProps {
  onNext: () => void;
}

export function PostgresReadonlyUserInstruction({ onNext }: PostgresReadonlyUserInstructionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCog className="text-primary size-5" />
          <CardTitle className="text-lg">[Optional] Creating a new PostgreSQL user</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTitle>Database Permissions</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              In the ReJot Limited Access Preview, you currently don&apos;t have access to the
              syncing functionality. You may still use your database connection to view your schemas
              and explore ReJot.
            </p>
            <p>
              We follow security best practices, and thus recommend you to create a{" "}
              <span className="font-bold">schema-read-only user</span> to your database. This will
              allow you (and us) to see your database&apos;s schemas (tables, columns, foreign keys,
              etc.) but <span className="font-bold">not</span> the contents of the tables.
            </p>
          </AlertDescription>
        </Alert>

        <p className="text-muted-foreground text-sm">
          You can follow these steps, or skip directly to the next step if you prefer to use your
          existing database user.
        </p>

        <ReadonlyUserStep
          stepNumber={1}
          title="Connect to Your Database"
          description="First, connect to your PostgreSQL database using psql or your preferred database client with an admin user."
        />

        <ReadonlyUserStep
          stepNumber={2}
          title="Create a new User"
          description="Create a new user with a secure password. Make sure to replace 'securepassword' with a strong password of your choice."
          code={`CREATE USER readonly_user WITH PASSWORD 'securepassword';`}
        />

        <ReadonlyUserStep
          stepNumber={3}
          title="Grant schema-read-only Permissions"
          description="Grant the necessary schema and catalog permissions to allow the user to view tables and their structures."
          code={`GRANT USAGE ON SCHEMA information_schema TO readonly_user;
GRANT SELECT ON TABLE 
    information_schema.columns, 
    information_schema.key_column_usage, 
    information_schema.table_constraints, 
    information_schema.constraint_column_usage 
TO readonly_user;
GRANT REFERENCES ON ALL TABLES IN SCHEMA public TO readonly_user;`}
        />
        <div className="flex justify-end">
          <Button onClick={onNext}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
