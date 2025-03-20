export const DEFAULT_SLOT_NAME = "rejot_slot";
export const DEFAULT_PUBLICATION_NAME = "rejot_publication";
export const SUPPORTED_SOURCE_SCHEMES = ["postgresql"];
export const SUPPORTED_SINK_SCHEMES = ["postgresql", "stdout", "file"];
export const SUPPORTED_SCHEMES = [...SUPPORTED_SOURCE_SCHEMES, ...SUPPORTED_SINK_SCHEMES];
export const DEFAULT_BACKFILL_TIMEOUT_MS = 60 * 1000; // 1 minute
export type ConnectionScheme = "postgresql" | "stdout" | "file";
