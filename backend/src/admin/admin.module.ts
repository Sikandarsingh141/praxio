import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import {
  RegistrationRequest,
  RegistrationRequestSchema,
} from '../registrations/schemas/registration-request.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminService } from './admin.service';
import {
  RepairQuotation,
  RepairQuotationSchema,
  RepairReview,
  RepairReviewSchema,
  RepairRequest,
  RepairRequestSchema,
} from '../customer/repair-request.schema';
import {
  AdminAuditLog,
  AdminAuditLogSchema,
} from './schemas/admin-audit-log.schema';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: RegistrationRequest.name, schema: RegistrationRequestSchema },
      { name: User.name, schema: UserSchema },
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: RepairRequest.name, schema: RepairRequestSchema },
      { name: RepairQuotation.name, schema: RepairQuotationSchema },
      { name: RepairReview.name, schema: RepairReviewSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [JwtAuthGuard, AdminRoleGuard, AdminService],
})
export class AdminModule {}
