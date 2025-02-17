import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Database } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConnectionNew() {
  const navigate = useNavigate();
  const organizationId = useSelectedOrganizationCode();

  if (!organizationId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Connection</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className="hover:bg-accent cursor-pointer transition-colors"
          onClick={() => navigate("postgres")}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="size-5" />
              <CardTitle>PostgreSQL</CardTitle>
            </div>
            <CardDescription>Connect to a PostgreSQL database to sync data</CardDescription>
          </CardHeader>
        </Card>

        {/* Add more connection types here in the future */}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate("/connections")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
