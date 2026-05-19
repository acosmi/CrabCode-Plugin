export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(opts: { level?: LogLevel; sink?: (line: string) => void } = {}): Logger {
  const minLevel = LEVEL_ORDER[opts.level ?? 'info'];
  const sink = opts.sink ?? ((line: string) => process.stderr.write(line + '\n'));

  function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < minLevel) return;
    const payload = { ts: new Date().toISOString(), level, message, ...(fields ?? {}) };
    sink(JSON.stringify(payload));
  }

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
  };
}
