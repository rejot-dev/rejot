export type AnyCollectionEntry<T = unknown> = {
  id: string;
  body?: string;
  collection: string;
  data: T;
  filePath?: string;
};

export function normalizeSlug(slug: string) {
  return slug.replace(/index$/, "").replace(/\d+_/g, "");
}
