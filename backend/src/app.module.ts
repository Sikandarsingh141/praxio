import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { DisputesModule } from './disputes/disputes.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '..', '.env'),
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        MONGO_URI: Joi.string()
          .pattern(/^mongodb(?:\+srv)?:\/\/[^<>]+$/)
          .required(),
        JWT_SECRET: Joi.string()
          .min(32)
          .pattern(/^[^\s"']+$/)
          .invalid('REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS_LONG')
          .required()
          .messages({
            'any.required': 'JWT_SECRET is required',
            'any.invalid': 'JWT_SECRET must not be the example placeholder',
            'string.base': 'JWT_SECRET must be a string',
            'string.empty': 'JWT_SECRET must not be empty',
            'string.min': 'JWT_SECRET must be at least 32 characters long',
            'string.pattern.base':
              'JWT_SECRET must not contain whitespace or quotes',
          }),
        JWT_EXPIRES_IN: Joi.number().integer().valid(86400).default(86400),
        STRIPE_SECRET_KEY: Joi.string()
          .pattern(/^sk_(test|live)_[A-Za-z0-9]+$/)
          .optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string()
          .pattern(/^whsec_[A-Za-z0-9]+$/)
          .optional(),
        FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
        FIREBASE_CLIENT_EMAIL: Joi.string().email().allow('').optional(),
        FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
        GOOGLE_APIKEY: Joi.string().allow('').optional(),
        GEOCODER_URL: Joi.string()
          .uri({ scheme: ['https'] })
          .optional(),

        FRONTEND_ORIGINS: Joi.string()
          .pattern(/^https?:\/\/[^,\s]+(?:,\s*https?:\/\/[^,\s]+)*$/)
          .required(),
      }),
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    AdminModule,
    DisputesModule,
    ChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
