import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RegistrationRequest,
  RegistrationRequestSchema,
} from '../registrations/schemas/registration-request.schema';
import {
  ShopSubscriptionInvoice,
  ShopSubscriptionInvoiceSchema,
} from './schemas/shop-subscription-invoice.schema';
import {
  RepairInvoice,
  RepairInvoiceSchema,
} from '../invoices/repair-invoice.schema';
import { StripePaymentsService } from './stripe-payments.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: RegistrationRequest.name, schema: RegistrationRequestSchema },
      {
        name: ShopSubscriptionInvoice.name,
        schema: ShopSubscriptionInvoiceSchema,
      },
      { name: RepairInvoice.name, schema: RepairInvoiceSchema },
    ]),
  ],
  providers: [StripePaymentsService],
  exports: [StripePaymentsService],
})
export class StripePaymentsModule {}
