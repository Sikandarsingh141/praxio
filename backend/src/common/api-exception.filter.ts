import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: string[];
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException) || statusCode >= 500) {
      const exceptionName =
        exception instanceof Error
          ? exception.constructor.name
          : 'UnknownError';
      const mongoDiagnostic = this.getMongoDiagnostic(exception);
      this.logger.error(
        `HTTP ${request.method} ${request.path} failed (${exceptionName})${mongoDiagnostic}`,
      );
    }

    const errorBody = this.getErrorBody(exception, statusCode);
    response.status(statusCode).json(errorBody);
  }

  private getErrorBody(exception: unknown, statusCode: number): ApiErrorBody {
    if (statusCode >= 500) {
      return {
        statusCode,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      };
    }
    if (!(exception instanceof HttpException)) {
      return {
        statusCode,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      };
    }

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') {
      return {
        statusCode,
        code: this.getDefaultCode(statusCode),
        message: exceptionResponse,
      };
    }
    if (!this.isRecord(exceptionResponse)) {
      return {
        statusCode,
        code: this.getDefaultCode(statusCode),
        message: exception.message,
      };
    }

    const message = exceptionResponse.message;
    const fieldErrors = Array.isArray(message)
      ? message.filter((item): item is string => typeof item === 'string')
      : undefined;
    const responseCode =
      typeof exceptionResponse.code === 'string'
        ? exceptionResponse.code
        : this.getDefaultCode(statusCode);
    const responseMessage =
      typeof message === 'string'
        ? message
        : fieldErrors?.length
          ? 'Request validation failed'
          : exception.message;

    return {
      statusCode,
      code: responseCode,
      message: responseMessage,
      ...(fieldErrors ? { fieldErrors } : {}),
    };
  }

  private getDefaultCode(statusCode: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
    };
    return codes[statusCode] ?? 'HTTP_ERROR';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getMongoDiagnostic(exception: unknown): string {
    if (!this.isRecord(exception) || exception.name !== 'MongoServerError') {
      return '';
    }

    const code =
      typeof exception.code === 'number' ? ` code=${exception.code}` : '';
    const codeName =
      typeof exception.codeName === 'string'
        ? ` codeName=${exception.codeName}`
        : '';
    const message =
      exception instanceof Error ? ` message=${exception.message}` : '';
    return `${code}${codeName}${message}`;
  }
}
