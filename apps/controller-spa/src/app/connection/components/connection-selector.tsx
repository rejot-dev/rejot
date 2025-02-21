import { Database, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Connection } from "@/data/connection/connection.data";

interface ConnectionSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  connections: Connection[];
  isLoading?: boolean;
  showNewConnection?: boolean;
  connectionDetails?: (connection: Connection) => React.ReactNode;
}

export function ConnectionSelector({
  value,
  onChange,
  className,
  connections,
  isLoading,
  showNewConnection = true,
  connectionDetails,
}: ConnectionSelectorProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <RadioGroup
        onValueChange={onChange}
        value={value}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {isLoading ? (
          <>
            {[...Array(3)].map((_, index) => (
              <Card key={index} className="relative p-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Skeleton className="mt-1 size-5 shrink-0 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-4" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : (
          <>
            {connections.map((connection) => (
              <div key={connection.slug} className="relative h-full">
                <RadioGroupItem value={connection.slug} id={connection.slug} className="sr-only" />
                <label htmlFor={connection.slug} className="block h-full cursor-pointer">
                  <Card
                    className={cn(
                      "hover:border-primary hover:bg-primary/5 relative h-full p-4 transition-colors",
                      value === connection.slug && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Database className="text-primary mt-1 size-5 shrink-0" />
                      <div>
                        <h4 className="text-base font-medium">{connection.slug}</h4>
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                          <span>{connection.config.database}</span>
                        </div>
                      </div>
                    </div>
                    {value === connection.slug && (
                      <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
                    )}
                  </Card>
                </label>
              </div>
            ))}
            {showNewConnection && (
              <div className="relative h-full">
                <RadioGroupItem value="new" id="new-connection" className="sr-only" />
                <Link to="/connections/new" className="block h-full">
                  <Card className="hover:border-primary hover:bg-primary/5 relative h-full p-4 transition-colors">
                    <div className="flex items-start gap-3">
                      <Plus className="text-primary mt-1 size-5" />
                      <div>
                        <h4 className="text-base font-medium">New Connection</h4>
                        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                          <span>Create a new connection</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            )}
          </>
        )}
      </RadioGroup>

      {connectionDetails && value && connectionDetails(connections.find((c) => c.slug === value)!)}
    </div>
  );
}
