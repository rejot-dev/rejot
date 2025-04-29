import type { Subprocess } from "bun";

export async function pollForResult<T>(
  fn: () => Promise<T>,
  check: (result: T) => boolean,
  intervalMs: number = 100,
  timeoutMs: number = 3000,
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (check(result)) {
      return result;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// Helper to print sync process output
export async function printSyncProcessOutput(syncProcess: Subprocess<"ignore", "pipe", "pipe">) {
  if (syncProcess.stdout) {
    const text = await Bun.readableStreamToText(syncProcess.stdout);
    console.log("[syncProcess stdout]\n" + text);
  }
  if (syncProcess.stderr) {
    const text = await Bun.readableStreamToText(syncProcess.stderr);
    console.log("[syncProcess stderr]\n" + text);
  }
}

// Helper to wait for process exit or timeout
export async function waitForProcessExitOrTimeout(
  proc: Subprocess<"ignore", "pipe", "pipe">,
  timeoutMs: number = 2000,
): Promise<boolean> {
  let exited = false;
  const race = Promise.race([
    proc.exited.then(() => {
      exited = true;
    }),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  await race;
  return exited;
}
