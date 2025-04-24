import { expect, test } from "bun:test";

import { ILogger, LogLevel, NamespacedLogger, shouldLog } from "./logger.ts";

class MockLogger extends ILogger {
  public messages: { type: LogLevel; message: string; args: unknown[] }[] = [];

  init(): void {
    this.messages = [];
  }

  log(type: LogLevel, message: string, ...args: unknown[]): void {
    this.messages.push({ type, message, args });
  }
}

test("MockLogger respects log levels", () => {
  const logger = new MockLogger(LogLevel.INFO);

  // Should not log DEBUG messages when level is INFO
  logger.debug("debug message");
  expect(logger.messages.length).toBe(0);

  // Should log INFO messages
  logger.info("info message");
  expect(logger.messages.length).toBe(1);
  expect(logger.messages[0].message).toBe("info message");

  // Should log ERROR messages (lower level than INFO)
  logger.error("error message");
  expect(logger.messages.length).toBe(2);
  expect(logger.messages[1].message).toBe("error message");
});

test("formatLogMessage formats messages correctly", () => {
  const logger = new MockLogger(LogLevel.ERROR);
  const message = logger.formatLogMessage(LogLevel.ERROR, "test message", {
    detail: "some detail",
  });

  expect(message).toMatch(/^\[ERROR\] \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Check timestamp format
  expect(message).toContain("test message");
  expect(message).toContain('{"detail":"some detail"}');
  expect(message.endsWith("\n")).toBe(true);
});

test("shouldLog correctly filters log levels", () => {
  const currentLevel = LogLevel.INFO;

  // Should log levels at or below current level
  expect(shouldLog(LogLevel.ERROR, currentLevel)).toBe(true);
  expect(shouldLog(LogLevel.WARN, currentLevel)).toBe(true);
  expect(shouldLog(LogLevel.INFO, currentLevel)).toBe(true);

  // Should not log levels above current level
  expect(shouldLog(LogLevel.DEBUG, currentLevel)).toBe(false);
  expect(shouldLog(LogLevel.TRACE, currentLevel)).toBe(false);
});

test("Logger level can be changed at runtime", () => {
  const logger = new MockLogger(LogLevel.ERROR);

  // Initially only ERROR messages should be logged
  logger.warn("warning message");
  expect(logger.messages.length).toBe(0);

  // Change log level to WARN
  logger.logLevel = LogLevel.WARN;

  // Now WARN messages should be logged
  logger.warn("warning message");
  expect(logger.messages.length).toBe(1);
  expect(logger.messages[0].message).toBe("warning message");
});

test("Logger handles multiple arguments", () => {
  const logger = new MockLogger(LogLevel.INFO);

  logger.info("test message", { a: 1 }, ["b", 2], "c");

  expect(logger.messages.length).toBe(1);
  expect(logger.messages[0].args).toEqual([{ a: 1 }, ["b", 2], "c"]);
});

test("NamespacedLogger adds namespace prefix to messages", () => {
  const mockLogger = new MockLogger(LogLevel.INFO);
  const namespacedLogger = new NamespacedLogger(mockLogger, "TestModule");

  namespacedLogger.info("test message");
  expect(mockLogger.messages.length).toBe(1);
  expect(mockLogger.messages[0].message).toBe("[TestModule] test message");
});

test("NamespacedLogger preserves log level filtering", () => {
  const mockLogger = new MockLogger(LogLevel.INFO);
  const namespacedLogger = new NamespacedLogger(mockLogger, "TestModule");

  // Should not log DEBUG messages
  namespacedLogger.debug("debug message");
  expect(mockLogger.messages.length).toBe(0);

  // Should log INFO messages
  namespacedLogger.info("info message");
  expect(mockLogger.messages.length).toBe(1);
});

test("NamespacedLogger forwards additional arguments", () => {
  const mockLogger = new MockLogger(LogLevel.INFO);
  const namespacedLogger = new NamespacedLogger(mockLogger, "TestModule");

  const testObj = { key: "value" };
  namespacedLogger.info("test message", testObj, 123);

  expect(mockLogger.messages.length).toBe(1);
  expect(mockLogger.messages[0].message).toBe("[TestModule] test message");
  expect(mockLogger.messages[0].args).toEqual([testObj, 123]);
});

test("NamespacedLogger init delegates to underlying logger", () => {
  const mockLogger = new MockLogger(LogLevel.INFO);
  const namespacedLogger = new NamespacedLogger(mockLogger, "TestModule");

  // Clear any existing messages
  mockLogger.messages = [];

  namespacedLogger.init();

  // The mock logger's init clears messages, so length should be 0
  expect(mockLogger.messages.length).toBe(0);
});

test("Multiple NamespacedLoggers can use the same underlying logger", () => {
  const mockLogger = new MockLogger(LogLevel.INFO);
  const moduleALogger = new NamespacedLogger(mockLogger, "ModuleA");
  const moduleBLogger = new NamespacedLogger(mockLogger, "ModuleB");

  moduleALogger.info("message from A");
  moduleBLogger.warn("message from B");

  expect(mockLogger.messages.length).toBe(2);
  expect(mockLogger.messages[0].message).toBe("[ModuleA] message from A");
  expect(mockLogger.messages[1].message).toBe("[ModuleB] message from B");
});

test("NamespacedLogger inherits log level changes from underlying logger", () => {
  const mockLogger = new MockLogger(LogLevel.ERROR);
  const namespacedLogger = new NamespacedLogger(mockLogger, "TestModule");

  // Initially only ERROR messages should be logged
  namespacedLogger.warn("warning message");
  expect(mockLogger.messages.length).toBe(0);

  // Change underlying logger's level to WARN
  mockLogger.logLevel = LogLevel.WARN;

  // Now WARN messages should be logged through the namespaced logger
  namespacedLogger.warn("warning message");
  expect(mockLogger.messages.length).toBe(1);
  expect(mockLogger.messages[0].message).toBe("[TestModule] warning message");
});

test("logErrorInstance handles regular Error objects", () => {
  const mockLogger = new MockLogger(LogLevel.ERROR);
  const error = new Error("Test error");

  mockLogger.logErrorInstance(error);

  // Should log each line of the stack trace
  expect(mockLogger.messages.length).toBeGreaterThan(1);
  expect(mockLogger.messages[0].message).toContain("Error: Test error");
  expect(mockLogger.messages.every((msg) => msg.type === LogLevel.ERROR)).toBe(true);
});

test("logErrorInstance handles Error with cause", () => {
  const mockLogger = new MockLogger(LogLevel.ERROR);
  const cause = new Error("Root cause");
  const error = new Error("Main error", { cause });

  mockLogger.logErrorInstance(error);

  // Should log both error stacks
  expect(mockLogger.messages.some((msg) => msg.message.includes("Error: Main error"))).toBe(true);
  expect(mockLogger.messages.some((msg) => msg.message.includes("Caused by: Root cause"))).toBe(
    true,
  );
  expect(mockLogger.messages.every((msg) => msg.type === LogLevel.ERROR)).toBe(true);
});

test("logErrorInstance handles non-Error objects", () => {
  const mockLogger = new MockLogger(LogLevel.ERROR);
  const notAnError = { message: "fake error" };

  mockLogger.logErrorInstance(notAnError);

  expect(mockLogger.messages.length).toBe(1);
  expect(mockLogger.messages[0].message).toBe("Not an error object:");
  expect(mockLogger.messages[0].args).toEqual([{ message: "fake error" }]);
  expect(mockLogger.messages[0].type).toBe(LogLevel.ERROR);
});
