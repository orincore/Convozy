import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

/**
 * Single place errors are turned into HTTP responses. Never let a raw error
 * shape leak to the client — always a consistent { code, message, details? }
 * body, and always logged with the correlation ID (CLAUDE.md §4).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.headers[CORRELATION_ID_HEADER] as string | undefined;

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException
      ? normalizeHttpExceptionBody(exception)
      : { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };

    this.logger.error(
      `[${correlationId ?? 'no-correlation-id'}] ${request.method} ${request.url} -> ${status}: ${JSON.stringify(
        body,
      )}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      ...body,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

function normalizeHttpExceptionBody(exception: HttpException): {
  code: string;
  message: string;
  details?: unknown;
} {
  const res = exception.getResponse();
  if (typeof res === 'string') {
    return { code: 'HTTP_ERROR', message: res };
  }
  const shaped = res as { code?: string; message?: string | string[]; details?: unknown };
  return {
    code: shaped.code ?? 'HTTP_ERROR',
    message: Array.isArray(shaped.message) ? shaped.message.join(', ') : (shaped.message ?? exception.message),
    details: shaped.details,
  };
}
