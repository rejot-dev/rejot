import { customAlphabet } from "nanoid";

// Max prefix length is 4 characters
export const Codes = [
  {
    prefix: "ORG",
    entity: "Organization",
  },
  {
    prefix: "SYS",
    entity: "System",
  },
  {
    prefix: "SYNC",
    entity: "Sync Service",
  },
  {
    prefix: "PERS",
    entity: "Person",
  },
  {
    prefix: "CONN",
    entity: "Connection",
  },
  {
    prefix: "PUBS",
    entity: "Public Schema",
  },
  {
    prefix: "CONS",
    entity: "Consumer Schema",
  },
] as const;

export type CodePrefix = (typeof Codes)[number]["prefix"];

// Define an alphabet that excludes the hyphen ('-'). This alphabet is similar to the default, except for the removal of '-'.
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const generateSuffix = customAlphabet(alphabet, 24);

/**
 * Generates an ID by concatenating a trusted prefix with a NanoID-generated suffix.
 * @param prefix A validated prefix from the allowed CodePrefix list.
 * @returns A string identifier consisting of the prefix followed by the generated suffix.
 */
export function generateCode(prefix: CodePrefix): string {
  return `${prefix}_${generateSuffix()}`;
}

export function generateCodeForEntity(entity: (typeof Codes)[number]["entity"]): string {
  const code = Codes.find((c) => c.entity === entity);
  if (!code) {
    throw new Error(`Invalid entity: ${entity}`);
  }
  return generateCode(code.prefix);
}
