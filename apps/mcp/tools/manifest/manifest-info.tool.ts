import { z } from "zod";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import { readManifest } from "@rejot-dev/contract-tools/manifest";
import { verifyManifests } from "@rejot-dev/contract/manifest";
import type { IRejotMcp } from "@/rejot-mcp";
import type { IFactory } from "@/rejot-mcp";

export class ManifestInfoTool implements IFactory {
  async initialize(mcp: IRejotMcp): Promise<void> {
    mcp.server.tool(
      "mcp_rejot_mcp_manifest_info",
      "Get information about the manifest",
      {
        manifestAbsoluteFilePath: z.string(),
      },
      async ({ manifestAbsoluteFilePath }) => {
        try {
          const manifest = await readManifest(manifestAbsoluteFilePath);
          const errors = verifyManifests([manifest]);

          if (!errors.isValid) {
            const errorMessages = errors.errors.map((error) => {
              let message = `  - ${error.message}`;
              if (error.hint) {
                message += `\n      Hint: ${error.hint.message}`;
                if (error.hint.suggestions) {
                  message += `\n      Suggestions: ${error.hint.suggestions}`;
                }
              }
              return message;
            });

            return {
              content: [
                { type: "text", text: "Manifest contains errors:\n" + errorMessages.join("\n\n") },
              ],
            };
          }

          const output = ManifestPrinter.printManifest(manifest);
          return {
            content: [{ type: "text", text: output.join("\n") }],
          };
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return {
              content: [
                {
                  isError: true,
                  type: "text",
                  text: `Manifest file not found at ${manifestAbsoluteFilePath}.`,
                },
              ],
            };
          }
          throw error;
        }
      },
    );
  }
}

// Legacy function for backward compatibility
export function registerManifestInfoTool(mcp: IRejotMcp): void {
  const tool = new ManifestInfoTool();
  void tool.initialize(mcp);
}
