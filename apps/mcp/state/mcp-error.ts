import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { ReJotError } from "@rejot-dev/contract/error";

export abstract class ReJotMcpError extends ReJotError {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }

  toCallToolContent(): CallToolResult["content"] {
    return [
      {
        isError: true,
        type: "text",
        text: getFormattedText(this.message, this.hints),
      },
    ];
  }

  toReadResourceContent(uri: string): ReadResourceResult["contents"] {
    return [
      {
        text: getFormattedText(this.message, this.hints),
        uri,
      },
    ];
  }
}

export function getFormattedText(message: string, hints: Readonly<string[]>): string {
  if (hints.length === 0) {
    return message;
  }

  const hintsText = hints.map((hint) => `\n• ${hint}`).join("");
  return `${message}\n\nHints:${hintsText}`;
}

export class WorkspaceNotInitializedError extends ReJotMcpError {
  get name(): string {
    return "WorkspaceNotInitializedError";
  }
}

export class CombinedRejotMcpError extends ReJotMcpError {
  #errors: ReJotError[];

  get name(): string {
    return "CombinedRejotMcpError";
  }

  constructor(errors: ReJotError[]) {
    super("CombinedRejotMcpError");
    this.#errors = errors;
  }

  toCallToolContent(): CallToolResult["content"] {
    return this.#errors.flatMap((e) => rejotErrorToCallToolContent(e) ?? []);
  }

  toReadResourceContent(uri: string): ReadResourceResult["contents"] {
    return this.#errors.flatMap((e) => rejotErrorToReadResourceContent(e, uri) ?? []);
  }
}

export function rejotErrorToCallToolContent(error: unknown): CallToolResult["content"] | null {
  if (error instanceof ReJotMcpError) {
    return error.toCallToolContent();
  }

  if (error instanceof ReJotError) {
    return [
      {
        isError: true,
        type: "text",
        text: error.message,
      },
    ];
  }

  return null;
}

export function rejotErrorToReadResourceContent(
  error: unknown,
  uri: string,
): ReadResourceResult["contents"] | null {
  if (error instanceof ReJotMcpError) {
    return error.toReadResourceContent(uri);
  }

  if (error instanceof ReJotError) {
    return [
      {
        text: error.message,
        uri,
      },
    ];
  }

  return null;
}
