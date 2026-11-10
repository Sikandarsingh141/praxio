import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  RepairRequest,
  RepairRequestSchema,
} from '../customer/repair-request.schema';
import { RegistrationsModule } from '../registrations/registrations.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  ChatConversation,
  ChatConversationSchema,
  ChatMessage,
  ChatMessageSchema,
} from './schemas/chat.schema';

@Module({
  imports: [
    AuthModule,
    RegistrationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    MongooseModule.forFeature([
      { name: ChatConversation.name, schema: ChatConversationSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: RepairRequest.name, schema: RepairRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
