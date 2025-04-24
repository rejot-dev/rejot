import fs from "fs";
import { fileURLToPath } from "url";

export const LogLevel = {
  ERROR: 0,
  WARN: 10,
  INFO: 20,
  DEBUG: 30,
  TRACE: 40,
} as const;

const LOG_LEVEL_MAX_LENGTH = Math.max(...Object.keys(LogLevel).map((level) => level.length));

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
  abstract log(type: LogLevel, message: string, ...args: unknown[]): void;

  protected _log(type: LogLevel, message: string, ...args: unknown[]): void {
    if (shouldLog(type, this.logLevel)) {
      this.log(type, message, ...args);
    }
  }

  formatLogMessage(type: LogLevel, message: string, ...args: unknown[]): string {
    let logMessage = `[${logLevelToStringPadded(type)}] ${new Date().toISOString()} - ${message}`;

    if (args.length > 0) {
      const serializedArgs = args.map(serializeArg);
      logMessage += ` ${JSON.stringify(serializedArgs)}`;
    }

    logMessage += "\n";

    return logMessage;
  }

  logErrorInstance(error: unknown, logLevel: LogLevel = LogLevel.ERROR): void {
    if (error instanceof Error) {
      const stack = error.stack?.split("\n") ?? [];

      this._log(logLevel, "Error: " + error.message + (!stack.length ? " (no stack trace)" : ""));

      for (const line of stack) {
        this._log(logLevel, line);
      }

      if (error.cause instanceof Error) {
        this._log(logLevel, `Caused by: ${error.cause.message}`);
        for (const stack of error.cause.stack?.split("\n") ?? []) {
          this._log(logLevel, stack);
        }
      }
    } else {
      this._log(logLevel, "Not an error object:", error);
    }
  }

  info(message: string, ...args: unknown[]): void {
    this._log(LogLevel.INFO, message, ...args);
  }
  warn(message: string, ...args: unknown[]): void {
    this._log(LogLevel.WARN, message, ...args);
  }
  error(message: string, ...args: unknown[]): void {
    this._log(LogLevel.ERROR, message, ...args);
  }
  debug(message: string, ...args: unknown[]): void {
    this._log(LogLevel.DEBUG, message, ...args);
  }
  trace(message: string, ...args: unknown[]): void {
    this._log(LogLevel.TRACE, message, ...args);
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

  log(type: LogLevel, message: string, ...args: unknown[]): void {
    // Override the timestamp part with elapsed time
    let logMessage = `[${logLevelToStringPadded(type)}] ${this.formatElapsedTime()} ${message}`;

    if (args.length > 0) {
      const serializedArgs = args.map(serializeArg);
      logMessage += ` ${JSON.stringify(serializedArgs)}`;
    }

    switch (type) {
      case LogLevel.INFO:
        console.log(logMessage);
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
        console.trace(logMessage);
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
    fs.writeFileSync(this.#logFilePath, this.formatLogMessage(LogLevel.ERROR, "Log Initialized."), {
      flag: "w",
    });
  }

  log(type: LogLevel, message: string, ...args: unknown[]): void {
    const logMessage = this.formatLogMessage(type, message, ...args);
    fs.appendFileSync(this.#logFilePath, logMessage);
  }
}

export class NoopLogger extends ILogger {
  init(): void {
    //
  }

  log(_type: LogLevel, _message: string, ..._args: unknown[]): void {
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

  log(type: LogLevel, message: string, ...args: unknown[]): void {
    if (this.#namespace) {
      this.#logger.log(type, `[${this.#namespace}] ${message}`, ...args);
    } else {
      this.#logger.log(type, message, ...args);
    }
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
