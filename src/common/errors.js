export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function isDuplicateEntry(error) {
  return error?.code === 'ER_DUP_ENTRY';
}
