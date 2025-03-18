export const DEFAULT_SLOT_NAME = "rejot_slot";
export const DEFAULT_PUBLICATION_NAME = "rejot_publication";
export const SUPPORTED_SOURCE_SCHEMES = ["postgresql"];
export const SUPPORTED_SINK_SCHEMES = ["postgresql", "stdout", "file"];
export const SUPPORTED_SCHEMES = [...SUPPORTED_SOURCE_SCHEMES, ...SUPPORTED_SINK_SCHEMES];
export const BACKFILL_TIMEOUT_SECONDS = 60;
export type ConnectionScheme = "postgresql" | "stdout" | "file";
