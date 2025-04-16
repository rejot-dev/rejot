import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

export abstract class ReJotMcpError extends Error {
  protected hints: string[] = [];

  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }

  withHint(hint: string): this {
    this.hints.push(hint);
    return this;
  }

  withHints(hints: string[]): this {
    this.hints.push(...hints);
    return this;
  }

  toCallToolContent(): CallToolResult["content"] {
    return [
      {
        isError: true,
        type: "text",
        text: this.getFormattedText(),
      },
    ];
  }

  toReadResourceContent(uri: string): ReadResourceResult["contents"] {
    return [
      {
        text: this.getFormattedText(),
        uri,
      },
    ];
  }

  protected getFormattedText(): string {
    if (this.hints.length === 0) {
      return this.message;
    }

    const hintsText = this.hints.map((hint) => `\n• ${hint}`).join("");

    return `${this.message}\n\nHints:${hintsText}`;
  }
}

export class WorkspaceNotInitializedError extends ReJotMcpError {
  get name(): string {
    return "WorkspaceNotInitializedError";
  }
}

export class CombinedRejotMcpError extends ReJotMcpError {
  #errors: ReJotMcpError[];

  constructor(errors: ReJotMcpError[]) {
    super("CombinedRejotMcpError");
    this.#errors = errors;
  }

  toCallToolContent(): CallToolResult["content"] {
    return this.#errors.flatMap((e) => e.toCallToolContent());
  }

  toReadResourceContent(uri: string): ReadResourceResult["contents"] {
    return this.#errors.flatMap((e) => e.toReadResourceContent(uri));
  }
}
