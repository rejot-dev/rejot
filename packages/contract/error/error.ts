export interface ReJotErrorOptions {
  hints?: string[];
  cause?: unknown;
}

export abstract class ReJotError extends Error {
  #hints: string[] = [];

  abstract get name(): string;

  constructor(message: string, options: ReJotErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.#hints = options.hints ?? [];
  }

  withHint(hint: string): this {
    this.#hints.push(hint);
    return this;
  }

  withHints(hints: string[]): this {
    this.#hints.push(...hints);
    return this;
  }

  get hints(): Readonly<string[]> {
    return this.#hints;
  }
}
