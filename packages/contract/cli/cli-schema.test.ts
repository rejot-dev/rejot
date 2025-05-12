import { describe, expect, it } from "bun:test";

import { Args, Command, Flags } from "@oclif/core";

import { extractCommandMetadata, generateCommandSchema } from "./cli-schema.ts";

describe("CLI Schema", () => {
  describe("extractCommandMetadata", () => {
    it("extracts metadata from a Command class", () => {
      class MockCommand extends Command {
        static override description = "Test command";
        static override examples = ["example command"];
        static override args = {
          test: Args.string({
            description: "Test argument",
            required: true,
          }),
        };
        static override flags = {
          flag: Flags.boolean({
            description: "Test flag",
            required: false,
          }),
          level: Flags.string({
            description: "Level option",
            options: ["low", "medium", "high"],
            default: "medium",
          }),
        };
        static override strict = true;

        async run(): Promise<void> {
          // Implementation not important for test
        }
      }

      const metadata = extractCommandMetadata("test:command", MockCommand);

      expect(metadata.id).toBe("test:command");
      expect(metadata.description).toBe("Test command");
      expect(metadata.examples).toEqual(["example command"]);
      expect(metadata.args).toBeDefined();
      expect(metadata.args?.["test"].description).toBe("Test argument");
      expect(metadata.flags).toBeDefined();
      expect(metadata.flags?.["flag"].description).toBe("Test flag");
      expect(metadata.flags?.["level"].options).toEqual(["low", "medium", "high"]);
      expect(metadata.flags?.["level"].default).toBe("medium");
      expect(metadata.flags?.["level"].type).toBe("option");
      expect(metadata.strict).toBe(true);
    });

    it("correctly identifies the type for string flags", () => {
      class CommandWithStringFlags extends Command {
        static override description = "Command with string flags";
        static override flags = {
          name: Flags.string({
            description: "Name string flag",
            required: true,
          }),
          optional: Flags.string({
            description: "Optional string flag",
          }),
        };

        async run(): Promise<void> {
          // Implementation not important for test
        }
      }

      const metadata = extractCommandMetadata("test:string-flags", CommandWithStringFlags);

      expect(metadata.flags).toBeDefined();
      expect(metadata.flags?.["name"].type).toBe("string");
      expect(metadata.flags?.["optional"].type).toBe("string");
    });

    it("handles command without args or flags", () => {
      class SimpleCommand extends Command {
        static override description = "Simple command";

        async run(): Promise<void> {
          // Implementation not important for test
        }
      }

      const metadata = extractCommandMetadata("simple", SimpleCommand);

      expect(metadata.id).toBe("simple");
      expect(metadata.description).toBe("Simple command");
      expect(metadata.args).toBeUndefined();
      expect(metadata.flags).toBeUndefined();
    });
  });

  describe("generateCommandSchema", () => {
    it("generates schema for multiple commands", () => {
      class Command1 extends Command {
        static override description = "Command 1";

        async run(): Promise<void> {
          // Implementation not important for test
        }
      }

      class Command2 extends Command {
        static override description = "Command 2";

        async run(): Promise<void> {
          // Implementation not important for test
        }
      }

      const testCommands = {
        "cmd:1": Command1,
        "cmd:2": Command2,
      };

      const schema = generateCommandSchema(testCommands);

      expect(Object.keys(schema.commands)).toHaveLength(2);
      expect(schema.commands["cmd:1"].description).toBe("Command 1");
      expect(schema.commands["cmd:2"].description).toBe("Command 2");
    });
  });
});
