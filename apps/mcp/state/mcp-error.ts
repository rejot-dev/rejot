import { ReJotError } from "@rejot-dev/contract/error";

import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

export abstract class ReJotMcpError extends ReJotError {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
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
  if (error instanceof ReJotError) {
    return [
      {
        isError: true,
        type: "text",
        text: getFormattedText(error.message, error.hints),
      },
    ];
  }

  return null;
}

export function rejotErrorToReadResourceContent(
  error: unknown,
  uri: string,
): ReadResourceResult["contents"] | null {
  if (error instanceof ReJotError) {
    return [
      {
        text: getFormattedText(error.message, error.hints),
        uri,
      },
    ];
  }

  return null;
}
