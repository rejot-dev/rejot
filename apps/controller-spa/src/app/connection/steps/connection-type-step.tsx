import { Link } from "react-router";
import { Database } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function ConnectionTypeStep() {
  const [selectedType, setSelectedType] = useState<string>("postgres");

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedType}
        onValueChange={setSelectedType}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div className="relative">
          <RadioGroupItem value="postgres" id="postgres" className="sr-only" />
          <label htmlFor="postgres" className="block cursor-pointer">
            <Card
              className={cn(
                "relative p-4 transition-colors",
                "hover:border-primary hover:bg-primary/5",
                selectedType === "postgres" && "border-primary bg-primary/5",
              )}
            >
              <CardHeader className="p-0">
                <div className="flex items-center gap-2">
                  <Database className="text-primary size-5" />
                  <CardTitle>PostgreSQL</CardTitle>
                </div>
                <CardDescription>Connect to a PostgreSQL database to sync data</CardDescription>
              </CardHeader>
              {selectedType === "postgres" && (
                <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
              )}
            </Card>
          </label>
        </div>

        <div className="relative">
          <RadioGroupItem value="coming-soon" id="coming-soon" className="sr-only" disabled />
          <label htmlFor="coming-soon" className="block cursor-pointer">
            <Card
              className={cn(
                "relative cursor-not-allowed p-4 opacity-50 transition-colors",
                selectedType === "coming-soon" && "border-primary bg-primary/5",
              )}
            >
              <CardHeader className="p-0">
                <div className="flex items-center gap-2">
                  <Database className="text-primary size-5" />
                  <CardTitle>More Databases Soon</CardTitle>
                </div>
                <CardDescription>
                  Additional database types will be supported in future updates
                </CardDescription>
              </CardHeader>
              {selectedType === "coming-soon" && (
                <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
              )}
            </Card>
          </label>
        </div>
      </RadioGroup>

      <Card className="p-4">
        <h4 className="mb-3 text-sm font-medium">Connection Type Details</h4>
        {selectedType === "postgres" ? (
          <div className="text-muted-foreground grid gap-4 text-sm">
            <div className="space-y-2">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  ReJot uses the Postgres write ahead log (WAL) to ingest changes from the database.
                </li>
                <li>Direct network access to database</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            Select a connection type to view details
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        {selectedType === "postgres" ? (
          <Link to="/connections/new/configure-connection?type=postgres">
            <Button>Continue</Button>
          </Link>
        ) : (
          <Button disabled className="cursor-not-allowed">
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
