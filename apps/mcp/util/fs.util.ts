import { isAbsolute } from "node:path";

import { ReJotMcpError } from "../state/mcp-error.ts";

export class PathNotRelativeError extends ReJotMcpError {
  #path: string;

  get name(): string {
    return "PathNotRelativeError";
  }

  get path(): string {
    return this.#path;
  }

  constructor(path: string) {
    super(`The path ${path} is not relative to the project directory.`);
    this.#path = path;
  }
}

export function ensurePathRelative(path: string): void {
  if (isAbsolute(path)) {
    throw new PathNotRelativeError(path);
  }
}
