import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import {
  RegistrationRequest,
  RegistrationRequestSchema,
} from './schemas/registration-request.schema';
import { RegistrationService } from './registration.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      {
        name: RegistrationRequest.name,
        schema: RegistrationRequestSchema,
      },
    ]),
  ],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationsModule {}
