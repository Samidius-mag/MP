import { api } from './api';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogOptions {
  component?: string;
  action?: string;
  url?: string;
  metadata?: Record<string, any>;
}

class ClientLogger {
  private isEnabled: boolean = true;

  constructor() {
    // Отключаем логирование в production для производительности
    if (process.env.NODE_ENV === 'production') {
      this.isEnabled = false;
    }
  }

  private async sendLog(level: LogLevel, message: string, options: LogOptions = {}) {
    if (!this.isEnabled) return;

    try {
      await api.post('/admin/logs/client', {
        level,
        message,
        component: options.component,
        action: options.action,
        url: options.url || window.location.href,
        metadata: options.metadata
      });
    } catch (error) {
      // Не логируем ошибки логирования, чтобы избежать бесконечных циклов
      console.warn('Failed to send client log:', error);
    }
  }

  error(message: string, options?: LogOptions) {
    console.error(`[CLIENT ERROR] ${message}`, options);
    this.sendLog('error', message, options);
  }

  warn(message: string, options?: LogOptions) {
    console.warn(`[CLIENT WARN] ${message}`, options);
    this.sendLog('warn', message, options);
  }

  info(message: string, options?: LogOptions) {
    console.info(`[CLIENT INFO] ${message}`, options);
    this.sendLog('info', message, options);
  }

  debug(message: string, options?: LogOptions) {
    console.debug(`[CLIENT DEBUG] ${message}`, options);
    this.sendLog('debug', message, options);
  }

  // Специальные методы для различных типов событий
  userAction(action: string, component: string, metadata?: Record<string, any>) {
    this.info(`User action: ${action}`, {
      component,
      action,
      metadata
    });
  }

  apiError(endpoint: string, error: any, metadata?: Record<string, any>) {
    this.error(`API Error: ${endpoint}`, {
      component: 'API',
      action: 'request',
      metadata: {
        endpoint,
        error: error?.message || error,
        status: error?.response?.status,
        ...metadata
      }
    });
  }

  navigation(from: string, to: string) {
    this.info(`Navigation: ${from} -> ${to}`, {
      component: 'Router',
      action: 'navigation',
      metadata: { from, to }
    });
  }

  componentError(component: string, error: any, metadata?: Record<string, any>) {
    this.error(`Component Error: ${component}`, {
      component,
      action: 'render',
      metadata: {
        error: error?.message || error,
        stack: error?.stack,
        ...metadata
      }
    });
  }
}

export const clientLogger = new ClientLogger();





