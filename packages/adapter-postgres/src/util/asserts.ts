export function assertUnreachable(_?: never): never {
  throw new Error("This code path is unreachable according to the type system.");
}

export function assert(b: boolean, message?: string): asserts b {
  if (!b) {
    throw new Error(message ?? "Assertion failed");
  }
}
