import fs from "fs";

export const LogLevel = {
  ERROR: 0,
  WARN: 10,
  INFO: 20,
  DEBUG: 30,
  TRACE: 40,
} as const;

export type LogLevelName = keyof typeof LogLevel;
export type LogLevel = (typeof LogLevel)[LogLevelName];

export function formatLogMessage(type: LogLevel, message: string, ...args: unknown[]): string {
  const levelName = Object.entries(LogLevel).find(([_, value]) => value === type)?.[0] ?? "UNKNOWN";
  let logMessage = `[${levelName}] ${new Date().toISOString()} - ${message}`;

  if (args.length > 0) {
    logMessage += ` ${JSON.stringify(args)}`;
  }

  logMessage += "\n";

  return logMessage;
}

export function shouldLog(type: LogLevel, currentLogLevel: LogLevel): boolean {
  return type <= currentLogLevel;
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
  init(): void {
    //
  }

  log(type: LogLevel, message: string, ...args: unknown[]): void {
    console.log(formatLogMessage(type, message, ...args));
  }
}

export class FileLogger extends ILogger {
  #logFilePath: string;

  constructor(logFilePath: string, logLevel: LogLevel | string = LogLevel.INFO) {
    super(logLevel);
    this.#logFilePath = logFilePath;
  }

  init(): void {
    fs.writeFileSync(this.#logFilePath, "Log Initialized.\n", { flag: "w" });
  }

  log(type: LogLevel, message: string, ...args: unknown[]): void {
    const logMessage = formatLogMessage(type, message, ...args);
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
  #namespace: string;

  constructor(logger: ILogger, namespace: string) {
    super();
    this.#logger = logger;
    this.#namespace = namespace;
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
    this.#logger.log(type, `[${this.#namespace}] ${message}`, ...args);
  }
}

let loggerSingleton: ILogger = new NoopLogger();

export const setLogLevel = (level: LogLevelName | string): void => {
  if (!(level in LogLevel)) {
    throw new Error(`Invalid log level: ${level}`);
  }

  loggerSingleton.logLevel = LogLevel[level as LogLevelName];
};

export function getLogger(namespace?: string): ILogger {
  if (namespace) {
    return new NamespacedLogger(loggerSingleton, namespace);
  }

  return loggerSingleton;
}

export function setLogger(logger: ILogger): ILogger {
  loggerSingleton = logger;
  loggerSingleton.init();

  return loggerSingleton;
}
