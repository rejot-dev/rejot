import { customAlphabet } from "nanoid";

// Max prefix length is 4 characters
export type CodePrefix = "ORG" | "SYS" | "SYNC" | "PERS" | "CONN";

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
