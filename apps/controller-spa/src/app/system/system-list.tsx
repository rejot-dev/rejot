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
import { ExternalLink, PlusCircle } from "lucide-react";
import { useSystems } from "@/data/system/system.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";

export interface SystemListProps {
  showNewSystemButton?: boolean;
}

export function SystemList({ showNewSystemButton = true }: SystemListProps) {
  const organizationCode = useSelectedOrganizationCode();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  const { data: systems, isLoading } = useSystems(organizationCode);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Systems</h2>
        {showNewSystemButton && (
          <Button asChild>
            <Link to="/systems/new" className="gap-2">
              <PlusCircle className="size-4" />
              Onboard New System
            </Link>
          </Button>
        )}
      </div>
      {isLoading ? (
        <div>Loading systems...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems?.map((system) => (
              <TableRow key={system.id}>
                <TableCell>{system.name}</TableCell>
                <TableCell>{system.slug}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" asChild>
                      <Link to={`/systems/${system.slug}`}>
                        <ExternalLink className="size-4" />
                        System Diagram
                      </Link>
                    </Button>
                  </div>
                </TableCell>
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
