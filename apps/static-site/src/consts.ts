export const REJOT_TITLE = "ReJot";
export const REJOT_TAG_LINE = "Supercharged Replication for Developers";
export const REJOT_DESCRIPTION =
  "Turn the write-ahead log of your database into an asynchronous communication channel for your services";

export function pageTitle(title: string) {
  const titleLength = title.length;

  if (titleLength <= 20) {
    return `${title} | ${REJOT_TITLE}`;
  }

  return `${title.slice(0, 20)}... | ${REJOT_TITLE}`;
}
