import path from "node:path";
import fs from "node:fs";

export interface ILogger {
  init(): void;
  log(type: "info" | "error" | "warn", message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

export class FileLogger implements ILogger {
  private logFilePath: string;

  constructor(logDirectory: string, logFileName: string = "server.log") {
    this.logFilePath = path.join(logDirectory, logFileName);
  }

  init(): void {
    fs.writeFileSync(this.logFilePath, "Server Log Start\n", { flag: "w" });
  }

  log(type: "info" | "error" | "warn", message: string, ...args: unknown[]): void {
    const logMessage = `[${type.toUpperCase()}] ${new Date().toISOString()} - ${message} ${JSON.stringify(args)}\n`;
    fs.appendFileSync(this.logFilePath, logMessage);
  }

  info(message: string, ...args: unknown[]): void {
    this.log("info", message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("error", message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, ...args);
  }
}

// Default instance using __dirname
export const defaultLogger = new FileLogger(__dirname);

// Exported functions that use the default logger
export function initLog() {
  defaultLogger.init();
}

export function log(type: "info" | "error" | "warn", message: string, ...args: unknown[]) {
  defaultLogger.log(type, message, ...args);
}

export function logInfo(message: string, ...args: unknown[]) {
  defaultLogger.info(message, ...args);
}

export function logError(message: string, ...args: unknown[]) {
  defaultLogger.error(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]) {
  defaultLogger.warn(message, ...args);
}
