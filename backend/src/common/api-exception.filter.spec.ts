import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiExceptionFilter } from './api-exception.filter';

@Controller('test-errors')
class TestErrorController {
  @Get('internal')
  throwInternalError(): never {
    throw new InternalServerErrorException('Sensitive database detail');
  }

  @Get('unauthorized')
  throwUnauthorizedError(): never {
    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    });
  }
}

describe('ApiExceptionFilter', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestErrorController],
    }).compile();

    app = module.createNestApplication<App>();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a generic message for internal errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/test-errors/internal')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(response.text).not.toContain('Sensitive database detail');
  });

  it('preserves the generic authentication error contract', async () => {
    await request(app.getHttpServer())
      .get('/api/test-errors/unauthorized')
      .expect(401, {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
  });
});
