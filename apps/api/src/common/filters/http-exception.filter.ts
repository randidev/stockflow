import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;

    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message: unknown }).message
        : isHttp
          ? exception.message
          : 'Internal server error';

    const errors = body && typeof body === 'object' && 'errors' in body ? (body as { errors: unknown }).errors : undefined;

    res.status(status).json({
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
