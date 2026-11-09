import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AdminModule } from './../src/admin/admin.module';
import { AuthModule } from './../src/auth/auth.module';
import { DatabaseModule } from './../src/database/database.module';
import { UsersModule } from './../src/users/users.module';
import { UsersService } from './../src/users/users.service';
import { JwtModule } from '@nestjs/jwt';

@Module({})
class TestDatabaseModule {}

@Module({})
class TestAdminModule {}

@Module({
  imports: [
    JwtModule.register({
      secret: 'test-secret-that-is-long-enough-for-jwt',
      signOptions: { expiresIn: 900 },
    }),
  ],
  exports: [JwtModule],
})
class TestAuthModule {}

@Module({
  providers: [
    {
      provide: UsersService,
      useValue: {
        findById: jest.fn().mockResolvedValue(null),
        findPendingShopAccounts: jest.fn().mockResolvedValue([]),
        updatePendingShopStatus: jest.fn().mockResolvedValue(null),
      },
    },
  ],
  exports: [UsersService],
})
class TestUsersModule {}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(TestDatabaseModule)
      .overrideModule(AuthModule)
      .useModule(TestAuthModule)
      .overrideModule(UsersModule)
      .useModule(TestUsersModule)
      .overrideModule(AdminModule)
      .useModule(TestAdminModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  afterEach(async () => {
    await app.close();
  });
});
