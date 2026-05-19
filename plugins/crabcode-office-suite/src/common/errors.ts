export class OfficeSuiteError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'OfficeSuiteError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export const ERROR_CODES = {
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  INVALID_INPUT: 'INVALID_INPUT',
  IO_FAILURE: 'IO_FAILURE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
