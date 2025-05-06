export const REJOT_TITLE = "ReJot";
export const REJOT_TAG_LINE = "Developer Defined Replication";
export const REJOT_DESCRIPTION =
  // "Open source database to database sync engine for enterprises with distributed architectures and teams.";
  "Open source database to database replication for distributed architectures.";
export function pageTitle(title: string) {
  const titleLength = title.length;

  if (titleLength <= 20) {
    return `${title} | ${REJOT_TITLE}`;
  }

  return `${title.slice(0, 20)}... | ${REJOT_TITLE}`;
}
