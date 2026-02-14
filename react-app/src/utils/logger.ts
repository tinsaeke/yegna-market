// Centralized logging utility
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  error?: Error;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private formatLog(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.context ? `[${entry.context}] ` : ''}${entry.message}`;
  }

  private createEntry(level: LogLevel, message: string, context?: string, data?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      error
    };
  }

  info(message: string, context?: string, data?: any) {
    const entry = this.createEntry('info', message, context, data);
    console.log(this.formatLog(entry), data || '');
  }

  warn(message: string, context?: string, data?: any) {
    const entry = this.createEntry('warn', message, context, data);
    console.warn(this.formatLog(entry), data || '');
  }

  error(message: string, error?: Error, context?: string, data?: any) {
    const entry = this.createEntry('error', message, context, data, error);
    console.error(this.formatLog(entry), error || '', data || '');
    
    // In production, send to error tracking service (e.g., Sentry)
    if (!this.isDevelopment && error) {
      this.sendToErrorTracking(entry);
    }
  }

  debug(message: string, context?: string, data?: any) {
    if (this.isDevelopment) {
      const entry = this.createEntry('debug', message, context, data);
      console.debug(this.formatLog(entry), data || '');
    }
  }

  private sendToErrorTracking(entry: LogEntry) {
    // Integration point for error tracking service
  }
}

export const logger = new Logger();
