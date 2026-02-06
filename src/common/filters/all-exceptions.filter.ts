import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/api-response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request?.url;

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse() as any;

      // Nest can return string | object. Also class-validator errors often arrive as message: string[]
      const message =
        typeof res === 'string'
          ? res
          : (Array.isArray(res?.message) ? res.message.join(', ') : res?.message) ||
            exception.message ||
            'Request failed';

      const details =
        typeof res === 'object'
          ? {
              statusCode: res?.statusCode ?? statusCode,
              error: res?.error,
              messages: res?.message,
            }
          : undefined;

      return response.status(statusCode).json(
        ApiResponse.error(message, {
          statusCode,
          path,
          timestamp,
          details,
        }),
      );
    }

    const message =
      (exception as any)?.message || 'Internal server error';

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiResponse.error(message, {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        path,
        timestamp,
      }),
    );
  }
}

