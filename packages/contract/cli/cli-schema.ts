import { Command } from "@oclif/core";
import type { Flag } from "@oclif/core/interfaces";

/**
 * Interface representing an argument in a command
 */
export interface CommandArgument {
  name: string;
  description?: string;
  required?: boolean;
  options?: readonly string[];
  default?: unknown;
}

/**
 * Interface representing a flag in a command
 */
export interface CommandFlag {
  name: string;
  description?: string;
  required?: boolean;
  options?: readonly string[];
  default?: unknown;
  type: string;
}

/**
 * Interface for OCLIF example format
 */
export interface CommandExample {
  command: string;
  description?: string;
}

/**
 * Interface representing a command's metadata
 */
export interface CommandMetadata {
  id: string;
  description?: string;
  examples?: string[] | CommandExample[];
  args?: Record<string, CommandArgument>;
  flags?: Record<string, CommandFlag>;
  strict?: boolean;
}

/**
 * Interface representing the entire schema of commands
 */
export interface CommandSchema {
  commands: Record<string, CommandMetadata>;
}

/**
 * Extracts metadata from a Command class
 */
export function extractCommandMetadata(
  commandId: string,
  CommandClass: typeof Command,
): CommandMetadata {
  const args: Record<string, CommandArgument> = {};
  const flags: Record<string, CommandFlag> = {};

  // Extract args if they exist
  if (CommandClass.args) {
    for (const [name, arg] of Object.entries(CommandClass.args)) {
      args[name] = {
        name,
        description: arg.description,
        required: arg.required,
        options: arg.options,
        default: arg.default,
      };
    }
  }

  // Extract flags if they exist
  if (CommandClass.flags) {
    for (const [name, flag] of Object.entries(CommandClass.flags)) {
      const flagData: CommandFlag = {
        name,
        description: flag.description,
        required: flag.required,
        default: flag.default,
        type: mapFlagType(flag),
      };

      // Only add options if they exist
      if ("options" in flag && flag.options) {
        flagData.options = flag.options as readonly string[];
      }

      flags[name] = flagData;
    }
  }

  return {
    id: commandId,
    description: CommandClass.description,
    // We need to handle the examples as is, since it could be various formats
    examples: CommandClass.examples as unknown as CommandExample[] | string[],
    args: Object.keys(args).length > 0 ? args : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    strict: CommandClass.strict,
  };
}

/**
 * Map OCLIF's internal flag types to our schema types
 */
function mapFlagType(flag: Flag<unknown>): string {
  // OCLIF string flags can have a type of "option"
  if (flag.type === "option" && !flag.options) {
    return "string";
  }

  return flag.type || "unknown";
}

/**
 * Generates a schema of all commands
 */
export function generateCommandSchema(commands: Record<string, typeof Command>): CommandSchema {
  const schema: CommandSchema = { commands: {} };

  for (const [id, CommandClass] of Object.entries(commands)) {
    schema.commands[id] = extractCommandMetadata(id, CommandClass);
  }

  return schema;
}
