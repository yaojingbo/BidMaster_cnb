/** Bid Master Web - 前端错误类 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "APP_ERROR",
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class NetworkError extends AppError {
  constructor(message: string = "Network request failed") {
    super(message, "NETWORK_ERROR", 0);
    this.name = "NetworkError";
  }
}

export class APIError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public endpoint?: string
  ) {
    super(message, "API_ERROR", statusCode);
    this.name = "APIError";
  }
}

export class FileError extends AppError {
  constructor(message: string, public fileName?: string) {
    super(message, "FILE_ERROR", 400);
    this.name = "FileError";
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
