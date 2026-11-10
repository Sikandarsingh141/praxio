import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  ParseIntPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Body,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import {
  CreateChatConversationDto,
  EditChatMessageDto,
  SendChatMessageDto,
} from './dto/chat.dto';
import { ChatGateway } from './chat.gateway';

@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiTags('Chat')
@ApiCookieAuth('access_token')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('eligible')
  async eligible(@Req() request: AuthenticatedRequest) {
    return {
      data: { options: await this.chat.getEligible(await this.actor(request)) },
    };
  }

  @Get('conversations')
  async conversations(
    @Req() request: AuthenticatedRequest,
    @Query('filter', new DefaultValuePipe('all')) filter: string,
    @Query('search', new DefaultValuePipe('')) search: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return {
      data: await this.chat.listConversations(
        await this.actor(request),
        ['all', 'active', 'archived'].includes(filter) ? filter : 'all',
        search.slice(0, 100),
        page,
        limit,
      ),
    };
  }

  @Get('unread-count')
  async unreadCount(@Req() request: AuthenticatedRequest) {
    return {
      data: {
        unreadCount: await this.chat.getUnreadMessageCount(
          await this.actor(request),
        ),
      },
    };
  }

  @Post('conversations')
  async createConversation(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateChatConversationDto,
  ) {
    const actor = await this.actor(request);
    const conversation = await this.chat.createOrGetConversation(
      actor,
      input.repairRequestId,
      input.shopId,
    );
    return {
      data: {
        conversation: await this.chat.eligibleConversation(
          actor,
          conversation._id.toString(),
        ),
      },
    };
  }

  @Get('conversations/:id')
  async getConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return {
      data: {
        conversation: await this.chat.eligibleConversation(
          await this.actor(request),
          id,
        ),
      },
    };
  }

  @Get('conversations/:id/messages')
  async messages(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return {
      data: {
        messages: await this.chat.getMessages(
          await this.actor(request),
          id,
          before,
        ),
      },
    };
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: SendChatMessageDto,
  ) {
    const actor = await this.actor(request);
    const message = await this.chat.sendMessage(actor, id, input);
    await this.gateway.broadcastNewMessage(actor, id, message);
    return { data: { message } };
  }

  @Post('conversations/:id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  )
  async uploadAttachments(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return {
      data: {
        attachments: await this.chat.uploadAttachments(
          await this.actor(request),
          id,
          files ?? [],
        ),
      },
    };
  }

  @Get('conversations/:id/attachments/:fileId/download')
  async downloadAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    const { attachment, stream } = await this.chat.getAttachment(
      await this.actor(request),
      id,
      fileId,
    );
    const safeName = encodeURIComponent(attachment.fileName);
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      disposition: `attachment; filename*=UTF-8''${safeName}`,
    });
  }

  @Patch('messages/:id')
  async editMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() input: EditChatMessageDto,
  ) {
    const actor = await this.actor(request);
    const message = await this.chat.editMessage(actor, id, input.content);
    this.gateway.broadcastMessageEdited(actor, message);
    return { data: { message } };
  }

  @Delete('messages/:id')
  async deleteMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const actor = await this.actor(request);
    const message = await this.chat.deleteMessage(actor, id);
    this.gateway.broadcastMessageDeleted(actor, message);
    return { data: { message } };
  }

  @Patch('conversations/:id/read')
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const actor = await this.actor(request);
    const result = await this.chat.markRead(actor, id);
    this.gateway.broadcastRead(actor, id, result.readerId);
    return { data: { read: true } };
  }

  @Patch('conversations/:id/archive')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('archived') archived: string,
  ) {
    return {
      data: {
        conversation: await this.chat.setArchived(
          await this.actor(request),
          id,
          archived === 'true',
        ),
      },
    };
  }

  private async actor(request: AuthenticatedRequest) {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required.');
    return this.chat.actorForUser(userId);
  }
}
