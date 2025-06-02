/**
 * Simple logger utility for SolushipX
 * Provides consistent logging across the application
 */

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(module = 'SolushipX') {
    this.module = module;
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  }

  _log(level, message, ...args) {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.module}]`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} [DEBUG]`, message, ...args);
        break;
      case LogLevel.INFO:
        console.log(`${prefix} [INFO]`, message, ...args);
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} [WARN]`, message, ...args);
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} [ERROR]`, message, ...args);
        break;
    }
  }

  debug(message, ...args) {
    this._log(LogLevel.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this._log(LogLevel.INFO, message, ...args);
  }

  warn(message, ...args) {
    this._log(LogLevel.WARN, message, ...args);
  }

  error(message, ...args) {
    this._log(LogLevel.ERROR, message, ...args);
  }

  // Performance logging
  time(label) {
    if (this.level <= LogLevel.DEBUG) {
      console.time(`${this.module}:${label}`);
    }
  }

  timeEnd(label) {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`${this.module}:${label}`);
    }
  }
}

// Factory function to create module-specific loggers
export const createLogger = (module) => {
  return new Logger(module);
};

// Default logger instance
export const logger = new Logger();

export default logger; 