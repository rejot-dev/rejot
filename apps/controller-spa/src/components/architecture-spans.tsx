import { Bolt, Album, Database, BookOpen } from "lucide-react";
import { RejotIcon } from "@/components/icons/rejot";
import { cn } from "@/lib/utils";
export interface ArchitectureSpanProps {
  className?: string;
  label?: string;
}

export function SpanSystem({ className, label }: ArchitectureSpanProps) {
  return (
    <span className={cn("font-semibold text-red-600", className)}>
      <Bolt className="inline-block size-4" /> {label ?? "System"}
    </span>
  );
}

export function SpanSyncService({ className, label }: ArchitectureSpanProps) {
  return (
    <span className={cn("font-semibold text-green-600", className)}>
      <RejotIcon strokeWidth={8} className="inline-block size-4 overflow-visible" />{" "}
      {label ?? "Sync Service"}
    </span>
  );
}

export function SpanDataStore({ className, label }: ArchitectureSpanProps) {
  return (
    <span className={cn("font-semibold text-blue-600", className)}>
      <Database className="inline-block size-4" /> {label ?? "Data Store"}
    </span>
  );
}

export function SpanPublicSchema({ className, label }: ArchitectureSpanProps) {
  return (
    <span className={cn("font-semibold text-purple-600", className)}>
      <Album className="inline-block size-4" /> {label ?? "Public Schema"}
    </span>
  );
}

export function SpanConsumerSchema({ className, label }: ArchitectureSpanProps) {
  return (
    <span className={cn("font-semibold text-orange-600", className)}>
      <BookOpen className="inline-block size-4" /> {label ?? "Consumer Schema"}
    </span>
  );
}
