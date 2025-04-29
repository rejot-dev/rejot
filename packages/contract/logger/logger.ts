import process from "node:process";

import fs from "fs";
import { fileURLToPath } from "url";

export const LogLevel = {
  /** Meant to be seen by the user in CLI scenarios. */
  USER: 0,
  ERROR: 5,
  WARN: 10,
  INFO: 20,
  DEBUG: 30,
  TRACE: 40,
} as const;

const LOG_LEVEL_MAX_LENGTH = Math.max(...Object.keys(LogLevel).map((level) => level.length));

let longestNamespaceLengthSeen = 0;

export type LogLevelName = keyof typeof LogLevel;
export type LogLevel = (typeof LogLevel)[LogLevelName];

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Map) {
    return Object.fromEntries(arg.entries());
  }
  return arg;
}

export function shouldLog(type: LogLevel, currentLogLevel: LogLevel): boolean {
  return type <= currentLogLevel;
}

export function logLevelToString(level: LogLevel): string {
  const logLevel = Object.entries(LogLevel).find(([_, value]) => value === level)?.[0];
  if (!logLevel) {
    throw new Error(`Invalid log level: ${level}`);
  }
  return logLevel;
}

export function logLevelToStringPadded(level: LogLevel): string {
  return logLevelToString(level).padEnd(LOG_LEVEL_MAX_LENGTH, " ");
}

export interface LogLine {
  type: LogLevel;
  message: string;
  namespace?: string;
  args?: unknown[];
}

export abstract class ILogger {
  #logLevel: LogLevel;

  constructor(logLevel: LogLevel | string = LogLevel.INFO) {
    if (typeof logLevel === "string") {
      if (!(logLevel in LogLevel)) {
        throw new Error(`Invalid log level: ${logLevel}`);
      }

      this.#logLevel = LogLevel[logLevel as LogLevelName];
    } else {
      this.#logLevel = logLevel;
    }
  }

  get logLevel(): LogLevel {
    return this.#logLevel;
  }

  set logLevel(level: LogLevel) {
    this.#logLevel = level;
  }

  abstract init(): void;
  abstract log(logLine: LogLine): void;

  protected _log({ type, message, namespace, args }: LogLine): void {
    if (shouldLog(type, this.logLevel)) {
      this.log({ type, message, namespace, args });
    }
  }

  formatLogMessage({ type, message, namespace, args }: LogLine): string {
    const namespaceString = namespace ? ` [${namespace}] ` : " ";
    let logMessage = `[${logLevelToStringPadded(type)}]${namespaceString}${new Date().toISOString()} - ${message}`;

    if (args && args.length > 0) {
      const serializedArgs = args.map(serializeArg);
      logMessage += ` ${JSON.stringify(serializedArgs)}`;
    }

    logMessage += "\n";

    return logMessage;
  }

  logErrorInstance(error: unknown, logLevel: LogLevel = LogLevel.ERROR, namespace?: string): void {
    if (!(error instanceof Error)) {
      this._log({
        type: logLevel,
        message: "Not an error object:",
        namespace,
        args: [error],
      });
      return;
    }

    const stack = error.stack?.split("\n") ?? [];

    this._log({
      type: logLevel,
      message: "Error: " + error.message + (!stack.length ? " (no stack trace)" : ""),
      namespace,
    });

    for (const line of stack) {
      this._log({
        type: logLevel,
        message: line,
        namespace,
      });
    }

    if (error.cause instanceof Error) {
      this._log({
        type: logLevel,
        message: `Caused by: ${error.cause.message}`,
        namespace,
      });
      for (const stack of error.cause.stack?.split("\n") ?? []) {
        this._log({
          type: logLevel,
          message: stack,
          namespace,
        });
      }
    } else if (error) {
      this._log({
        type: logLevel,
        message: "Cause not an error object:",
        namespace,
        args: [error],
      });
    }
  }

  user(message: string, ...args: unknown[]): void {
    this._log({
      type: LogLevel.USER,
      message,
      namespace: undefined,
      args,
    });
  }

  info(message: string, ...args: unknown[]): void {
    this._log({
      type: LogLevel.INFO,
      message,
      namespace: undefined,
      args,
    });
  }
  warn(message: string, ...args: unknown[]): void {
    this._log({
      type: LogLevel.WARN,
      message,
      namespace: undefined,
      args,
    });
  }
  error(message: string, ...args: unknown[]): void {
    this._log({
      type: LogLevel.ERROR,
      message,
      namespace: undefined,
      args,
    });

    if (args.length > 0) {
      if (args[0] instanceof Error) {
        this.logErrorInstance(args[0]);
      } else if (typeof args[0] === "object" && args[0] !== null && "error" in args[0]) {
        this.logErrorInstance(args[0].error);
      }
    }
  }
  debug(message: string, ...args: unknown[]): void {
    this._log({
      type: LogLevel.DEBUG,
      message,
      namespace: undefined,
      args,
    });
  }
  trace(message: string, ...args: unknown[]): void {
    this._log({
      type: LogLevel.TRACE,
      message,
      namespace: undefined,
      args,
    });
  }
}

export class ConsoleLogger extends ILogger {
  #lastLogTime: number;

  constructor(logLevel: LogLevel | string = LogLevel.INFO) {
    super(logLevel);
    this.#lastLogTime = Date.now();
  }

  init(): void {
    this.#lastLogTime = Date.now();
  }

  formatElapsedTime(): string {
    const now = Date.now();
    const elapsed = now - this.#lastLogTime;
    this.#lastLogTime = now;

    let formattedElapsedTime = "";
    // Format as ms/s/m depending on duration
    if (elapsed < 1000) {
      formattedElapsedTime = `${elapsed}ms`;
    } else if (elapsed < 60000) {
      formattedElapsedTime = `${(elapsed / 1000).toFixed(0)}s`;
    } else {
      formattedElapsedTime = `${(elapsed / 60000).toFixed(0)}m`;
    }

    return ("+" + formattedElapsedTime).padStart(5, " ");
  }

  log({ type, message, namespace, args }: LogLine): void {
    if (type === LogLevel.USER) {
      console.log(message, ...(args ?? []));
      return;
    }

    const timestamp = process.stdout.isTTY ? this.formatElapsedTime() : new Date().toISOString();
    const namespaceString = (namespace ?? "").padEnd(longestNamespaceLengthSeen);

    let logMessage = `[${logLevelToStringPadded(type)}] ${timestamp} [${namespaceString}] ${message}`;

    if (args && args.length > 0) {
      const serializedArgs = args.map(serializeArg);
      logMessage += ` ${JSON.stringify(serializedArgs)}`;
    }

    switch (type) {
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.TRACE:
        console.log(logMessage);
        break;
    }
  }
}

export class FileLogger extends ILogger {
  #logFilePath: string;

  constructor(logFilePath: string, logLevel: LogLevel | string = LogLevel.INFO) {
    super(logLevel);
    this.#logFilePath = logFilePath;
  }

  init(): void {
    fs.writeFileSync(
      this.#logFilePath,
      this.formatLogMessage({
        type: LogLevel.ERROR,
        message: "Log Initialized.",
        namespace: undefined,
        args: [],
      }),
      {
        flag: "w",
      },
    );
  }

  log(logLine: LogLine): void {
    const logMessage = this.formatLogMessage(logLine);
    fs.appendFileSync(this.#logFilePath, logMessage);
  }
}

export class NoopLogger extends ILogger {
  init(): void {
    //
  }

  log(_logLine: LogLine): void {
    //
  }
}

export class NamespacedLogger extends ILogger {
  #logger: ILogger;
  #namespace?: string;

  constructor(logger: ILogger, namespace?: string) {
    super();
    this.#logger = logger;
    this.#namespace = namespace;
    if (namespace && namespace.length > longestNamespaceLengthSeen) {
      longestNamespaceLengthSeen = namespace.length;
    }
  }

  swapLogger(logger: ILogger): void {
    this.#logger = logger;
  }

  get logLevel(): LogLevel {
    return this.#logger.logLevel;
  }

  set logLevel(level: LogLevel) {
    this.#logger.logLevel = level;
  }

  init(): void {
    this.#logger.init();
  }

  log(logLine: LogLine): void {
    this.#logger.log({
      ...logLine,
      namespace: this.#namespace,
    });
  }
}

let loggerSingleton: ILogger = new NoopLogger();

export const setLogLevel = (level: LogLevelName | string): void => {
  if (!(level in LogLevel)) {
    throw new Error(`Invalid log level: ${level}`);
  }

  loggerSingleton.logLevel = LogLevel[level as LogLevelName];
};

const loggerInstances: NamespacedLogger[] = [];

/**
 *
 * @param namespace recommended to be import.meta.url
 * @returns
 */
export function getLogger(namespace?: string): ILogger {
  namespace = getNamespaceFromFilePath(namespace);

  const instance = new NamespacedLogger(loggerSingleton, namespace);
  loggerInstances.push(instance);
  return instance;
}

export function setLogger(logger: ILogger): ILogger {
  loggerSingleton = logger;
  loggerSingleton.init();

  for (const instance of loggerInstances) {
    instance.swapLogger(logger);
  }

  return loggerSingleton;
}

function getNamespaceFromFilePath(namespace?: string): string | undefined {
  if (!namespace) {
    return namespace;
  }

  if (!namespace.startsWith("file://")) {
    return namespace;
  }

  const path = fileURLToPath(namespace);
  // Find either packages or apps directory in the path
  const packagesIndex = path.indexOf("/packages/");
  const appsIndex = path.indexOf("/apps/");

  if (packagesIndex !== -1) {
    // Get the relative path starting from packages/
    return path.substring(packagesIndex + 1); // +1 to remove the leading slash
  } else if (appsIndex !== -1) {
    // Get the relative path starting from apps/
    return path.substring(appsIndex + 1); // +1 to remove the leading slash
  }

  return namespace;
}

export class MockLogger extends ILogger {
  public messages: LogLine[] = [];

  init(): void {
    this.messages = [];
  }

  log(logLine: LogLine): void {
    this.messages.push(logLine);
  }
}
