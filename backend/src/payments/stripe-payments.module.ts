import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RegistrationRequest,
  RegistrationRequestSchema,
} from '../registrations/schemas/registration-request.schema';
import { StripePaymentsService } from './stripe-payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RegistrationRequest.name, schema: RegistrationRequestSchema },
    ]),
  ],
  providers: [StripePaymentsService],
  exports: [StripePaymentsService],
})
export class StripePaymentsModule {}
