import debug from "debug";

const BASE_NAMESPACE = "rejot";

// Create different logger levels
export const logger = {
  // Info logs
  info: debug(`${BASE_NAMESPACE}:info`),

  // Warning logs
  warn: debug(`${BASE_NAMESPACE}:warn`),

  // Error logs
  error: debug(`${BASE_NAMESPACE}:error`),

  // Debug logs for detailed information
  debug: debug(`${BASE_NAMESPACE}:debug`),

  // Trace logs for very detailed debugging
  trace: debug(`${BASE_NAMESPACE}:trace`),

  // Create a namespaced logger for specific components
  createLogger: (namespace: string) => ({
    info: debug(`${BASE_NAMESPACE}:${namespace}:info`),
    warn: debug(`${BASE_NAMESPACE}:${namespace}:warn`),
    error: debug(`${BASE_NAMESPACE}:${namespace}:error`),
    debug: debug(`${BASE_NAMESPACE}:${namespace}:debug`),
    trace: debug(`${BASE_NAMESPACE}:${namespace}:trace`),
  }),
};

// Log level type
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

// Set log level function that replaces individual enable functions
export const setLogLevel = (level: LogLevel): void => {
  switch (level) {
    case "error":
      debug.enable(`${BASE_NAMESPACE}*:error`);
      break;
    case "warn":
      debug.enable(`${BASE_NAMESPACE}:*:error,${BASE_NAMESPACE}:*:warn`);
      break;
    case "info":
      debug.enable(`${BASE_NAMESPACE}:*:error,${BASE_NAMESPACE}:*:warn,${BASE_NAMESPACE}:*:info`);
      break;
    case "debug":
      debug.enable(
        `${BASE_NAMESPACE}:*:error,${BASE_NAMESPACE}:*:warn,${BASE_NAMESPACE}:*:info,${BASE_NAMESPACE}:*:debug`,
      );
      break;
    case "trace":
      debug.enable(
        `${BASE_NAMESPACE}:*:error,${BASE_NAMESPACE}:*:warn,${BASE_NAMESPACE}:*:info,${BASE_NAMESPACE}:*:debug,${BASE_NAMESPACE}:*:trace`,
      );
      break;
    default:
      debug.enable(`${BASE_NAMESPACE}:*`);
      break;
  }
};

// Default log level
setLogLevel("info");

export type Logger = {
  info: debug.Debugger;
  warn: debug.Debugger;
  error: debug.Debugger;
  debug: debug.Debugger;
  trace: debug.Debugger;
};

export default logger;
