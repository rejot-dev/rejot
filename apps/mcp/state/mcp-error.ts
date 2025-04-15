import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export abstract class ReJotMcpError extends Error {
  constructor(message: string) {
    super(message);
  }

  abstract toContent(): CallToolResult["content"];
}

export class SyncManifestNotInitializedError extends ReJotMcpError {
  toContent(): CallToolResult["content"] {
    return [
      {
        isError: true,
        type: "text",
        text: this.message,
      },
    ];
  }
}
