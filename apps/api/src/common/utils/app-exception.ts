import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * All thrown errors in this codebase should use AppException (or a NestJS
 * HttpException subclass) with a machine-readable code — never raw strings.
 * See CLAUDE.md §4.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundAppException extends AppException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.NOT_FOUND, details);
  }
}

export class ConflictAppException extends AppException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}
