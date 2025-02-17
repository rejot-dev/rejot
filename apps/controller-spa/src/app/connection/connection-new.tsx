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
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">New Connection</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => navigate("postgres")}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
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
