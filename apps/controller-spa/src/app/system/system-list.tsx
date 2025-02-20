import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { setSelectedSystemSlug } from "./system.state";
import { useSystems } from "@/data/system/system.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";

export function SystemList() {
  const organizationCode = useSelectedOrganizationCode();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  const { data: systems, isLoading } = useSystems(organizationCode);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Systems</h2>
        <Button asChild>
          <Link to="/systems/new" className="gap-2">
            <PlusCircle className="size-4" />
            Onboard New System
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <div>Loading systems...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Slug</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems?.map((system) => (
              <TableRow key={system.code}>
                <TableCell>
                  <Link
                    onClick={() => setSelectedSystemSlug(system.slug)}
                    to={`/systems/${system.slug}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {system.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono">{system.code}</TableCell>
                <TableCell>{system.slug}</TableCell>
              </TableRow>
            ))}
            {!systems?.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  No systems found. Get started by onboarding your first system.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
