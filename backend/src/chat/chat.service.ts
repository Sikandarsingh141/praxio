import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, mongo, Types } from 'mongoose';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { RepairRequest } from '../customer/repair-request.schema';
import { RegistrationService } from '../registrations/registration.service';
import { User } from '../users/schemas/user.schema';
import {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
} from './schemas/chat.schema';

export type ChatActor = { userId: string; role: 'customer' | 'shop' };

type ChatUserView = {
  _id: Types.ObjectId;
  fullName?: string;
  email?: string;
  profileImageData?: string;
  shopDetails?: { shopName?: string };
};

type ChatReplyView = {
  _id: Types.ObjectId;
  content?: string;
  isDeleted: boolean;
};

type ChatRepairView = {
  _id: Types.ObjectId;
  appliance?: string;
  repairJob?: { status?: string };
  status?: string;
};

type ChatConversationView = {
  _id: Types.ObjectId;
  customerId: Types.ObjectId | ChatUserView;
  shopId: Types.ObjectId | ChatUserView;
  repairRequestId: Types.ObjectId | ChatRepairView;
  participants: Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
  customerUnreadCount: number;
  shopUnreadCount: number;
  archivedBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

type ChatMessageView = {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId | ChatUserView;
  senderRole: 'customer' | 'shop';
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  content: string;
  attachments: ChatAttachment[];
  repliedToMessageId?: Types.ObjectId | ChatReplyView | null;
  clientMessageId?: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  readBy: Types.ObjectId[];
  deliveredTo: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

export type ChatMessageResult = {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; name: string; profileImageUrl: string | null };
  senderRole: 'customer' | 'shop';
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  content: string;
  attachments: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    id: string;
    uploadedAt: Date;
  }>;
  repliedTo: { id: string; content: string; isDeleted: boolean } | null;
  clientMessageId?: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  readBy: string[];
  deliveredTo: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type ChatDeletedMessageResult = {
  id: string;
  conversationId: string;
  isDeleted: true;
  deletedAt?: Date;
  lastMessage: string;
  lastMessageAt?: Date;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ChatConversation.name)
    private readonly conversations: Model<ChatConversation>,
    @InjectModel(ChatMessage.name)
    private readonly messages: Model<ChatMessage>,
    @InjectModel(RepairRequest.name)
    private readonly repairRequests: Model<RepairRequest>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    private readonly registrations: RegistrationService,
  ) {}

  async actorForUser(userId: string): Promise<ChatActor> {
    const user = await this.users
      .findById(userId)
      .select('accountType accountStatus accountLifecycleStatus')
      .lean()
      .exec();
    if (
      !user ||
      (user.accountType !== 'customer' && user.accountType !== 'shop') ||
      user.accountStatus !== 'active' ||
      (user.accountLifecycleStatus !== undefined &&
        user.accountLifecycleStatus !== 'active')
    ) {
      throw new ForbiddenException(
        'Chat access is not available for this account.',
      );
    }
    if (user.accountType === 'shop') {
      const registration =
        await this.registrations.findShopRequestForUser(userId);
      if (
        !registration ||
        registration.registrationStatus !== 'approved' ||
        registration.paymentStatus !== 'paid'
      ) {
        throw new ForbiddenException(
          'Shop chat access requires approval and an active subscription.',
        );
      }
    }
    return { userId, role: user.accountType };
  }

  async getEligible(actor: ChatActor) {
    const filter =
      actor.role === 'customer'
        ? { customerId: this.id(actor.userId) }
        : { shopIds: this.id(actor.userId) };
    const requests = await this.repairRequests
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('customerId shopIds appliance status repairJob shopResponses')
      .lean()
      .exec();
    const counterpartIds = [
      ...new Set(
        requests.flatMap((request) =>
          actor.role === 'customer'
            ? request.shopIds.map((id) => id.toString())
            : [request.customerId.toString()],
        ),
      ),
    ];
    const counterpartUsers = await this.users
      .find({ _id: { $in: counterpartIds } })
      .select('fullName email profileImageData shopDetails.shopName')
      .lean()
      .exec();
    const userMap = new Map(
      counterpartUsers.map((user) => [user._id.toString(), user]),
    );
    return requests.flatMap((request) => {
      const peerIds =
        actor.role === 'customer'
          ? request.shopIds.map((id) => id.toString())
          : [request.customerId.toString()];
      return peerIds.map((peerId) => ({
        repairRequestId: request._id.toString(),
        appliance: request.appliance,
        repairStatus: request.repairJob?.status ?? request.status,
        shopId: actor.role === 'shop' ? actor.userId : peerId,
        participant: this.userSummary(userMap.get(peerId)),
      }));
    });
  }

  async listConversations(
    actor: ChatActor,
    filter: string,
    search: string,
    page: number,
    limit: number,
  ) {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      throw new BadRequestException('Invalid conversation page.');
    }
    const userId = this.id(actor.userId);
    const filterQuery: Record<string, unknown> = { participants: userId };
    if (filter === 'archived') filterQuery.archivedBy = userId;
    if (filter === 'active') filterQuery.archivedBy = { $ne: userId };
    if (search.trim()) {
      const expression = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      const [people, requests] = await Promise.all([
        this.users
          .find({
            $or: [
              { fullName: expression },
              { 'shopDetails.shopName': expression },
              { email: expression },
            ],
          })
          .select('_id')
          .limit(100)
          .lean()
          .exec(),
        this.repairRequests
          .find({ appliance: expression })
          .select('_id')
          .limit(100)
          .lean()
          .exec(),
      ]);
      filterQuery.$or = [
        { lastMessage: expression },
        ...(actor.role === 'customer'
          ? [{ shopId: { $in: people.map((person) => person._id) } }]
          : [{ customerId: { $in: people.map((person) => person._id) } }]),
        { repairRequestId: { $in: requests.map((request) => request._id) } },
      ];
    }
    const [conversations, total] = await Promise.all([
      this.conversations
        .find(filterQuery)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customerId', 'fullName email profileImageData')
        .populate(
          'shopId',
          'fullName email profileImageData shopDetails.shopName',
        )
        .populate('repairRequestId', 'appliance status repairJob')
        .lean<ChatConversationView[]>()
        .exec(),
      this.conversations.countDocuments(filterQuery).exec(),
    ]);
    const messageCounts = await this.messages
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            conversationId: { $in: conversations.map((conversation) => conversation._id) },
          },
        },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } },
      ])
      .exec();
    const messageCountByConversation = new Map(
      messageCounts.map(({ _id, count }) => [_id.toString(), count]),
    );
    const unreadField =
      actor.role === 'customer' ? 'customerUnreadCount' : 'shopUnreadCount';
    const archivedBy = userId.toString();
    return {
      conversations: conversations.map((conversation) => {
        const peer =
          actor.role === 'customer'
            ? this.userSummary(conversation.shopId)
            : this.userSummary(conversation.customerId);
        return {
          id: conversation._id.toString(),
          customer: this.userSummary(conversation.customerId),
          shop: this.userSummary(conversation.shopId),
          participant: peer,
          repairRequest: this.repairSummary(conversation.repairRequestId),
          lastMessage: conversation.lastMessage ?? '',
          lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
          messageCount: messageCountByConversation.get(conversation._id.toString()) ?? 0,
          unreadCount: conversation[unreadField],
          archived: conversation.archivedBy.some(
            (id) => id.toString() === archivedBy,
          ),
        };
      }),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async getUnreadMessageCount(actor: ChatActor): Promise<number> {
    const unreadField =
      actor.role === 'customer' ? 'customerUnreadCount' : 'shopUnreadCount';
    const [result] = await this.conversations
      .aggregate<{ total: number }>([
        { $match: { participants: this.id(actor.userId) } },
        { $group: { _id: null, total: { $sum: `$${unreadField}` } } },
      ])
      .exec();
    return result?.total ?? 0;
  }

  async createOrGetConversation(
    actor: ChatActor,
    repairRequestId: string,
    shopId: string,
  ) {
    const customerId =
      actor.role === 'customer' ? this.id(actor.userId) : undefined;
    const request = await this.repairRequests
      .findById(repairRequestId)
      .select('customerId shopIds')
      .lean()
      .exec();
    if (!request) throw new NotFoundException('Repair request not found.');
    const resolvedCustomerId = customerId ?? request.customerId;
    if (actor.role === 'shop' && shopId !== actor.userId) {
      throw new ForbiddenException('You can only chat as your own shop.');
    }
    if (
      actor.role === 'customer' &&
      request.customerId.toString() !== actor.userId
    ) {
      throw new ForbiddenException(
        'This repair request does not belong to you.',
      );
    }
    if (!request.shopIds.some((id) => id.toString() === shopId)) {
      throw new ForbiddenException(
        'This repair request has not been shared with the selected shop.',
      );
    }
    const shop = await this.users
      .findOne({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        $or: [
          { accountLifecycleStatus: 'active' },
          { accountLifecycleStatus: { $exists: false } },
        ],
      })
      .select('_id')
      .lean()
      .exec();
    if (!shop) throw new ForbiddenException('This shop is not available.');
    return this.conversations
      .findOneAndUpdate(
        {
          repairRequestId: this.id(repairRequestId),
          customerId: resolvedCustomerId,
          shopId: this.id(shopId),
        },
        {
          $setOnInsert: {
            customerId: resolvedCustomerId,
            shopId: this.id(shopId),
            repairRequestId: this.id(repairRequestId),
            participants: [resolvedCustomerId, this.id(shopId)],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async getConversation(actor: ChatActor, conversationId: string) {
    return this.requireConversation(actor, conversationId);
  }

  async getMessages(actor: ChatActor, conversationId: string, before?: string) {
    await this.requireConversation(actor, conversationId);
    const filter: Record<string, unknown> = {
      conversationId: this.id(conversationId),
    };
    if (before) {
      const cursor = new Date(before);
      if (Number.isNaN(cursor.getTime())) {
        throw new BadRequestException('Invalid message page cursor.');
      }
      filter.createdAt = { $lt: cursor };
    }
    const messages = await this.messages
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .populate('senderId', 'fullName profileImageData')
      .populate('repliedToMessageId', 'content senderId isDeleted')
      .lean<ChatMessageView[]>()
      .exec();
    return messages.reverse().map((message) => this.messageDto(message));
  }

  async sendMessage(
    actor: ChatActor,
    conversationId: string,
    input: {
      content?: string;
      attachmentIds?: string[];
      repliedToMessageId?: string;
      clientMessageId?: string;
    },
  ) {
    const conversation = await this.requireConversation(actor, conversationId);
    const content = input.content?.trim() ?? '';
    const attachmentIds = input.attachmentIds ?? [];
    if (!content && !attachmentIds.length) {
      throw new BadRequestException('Write a message or attach a file.');
    }
    const senderId = this.id(actor.userId);
    if (input.clientMessageId) {
      const existing = await this.messages
        .findOne({
          conversationId: conversation._id,
          senderId,
          clientMessageId: input.clientMessageId,
        })
        .populate('senderId', 'fullName profileImageData')
        .populate('repliedToMessageId', 'content senderId isDeleted')
        .lean<ChatMessageView>()
        .exec();
      if (existing) return this.messageDto(existing);
    }
    let repliedToMessageId: Types.ObjectId | undefined;
    if (input.repliedToMessageId) {
      const original = await this.messages.findOne({
        _id: this.id(input.repliedToMessageId),
        conversationId: conversation._id,
      });
      if (!original) throw new NotFoundException('Reply message not found.');
      repliedToMessageId = original._id;
    }
    const attachments = await this.getUploadedAttachments(
      actor,
      conversation._id,
      attachmentIds,
    );
    const message = await this.messages.create({
      conversationId: conversation._id,
      senderId,
      senderRole: actor.role,
      messageType: attachments.length
        ? attachments.every((item) => item.mimeType.startsWith('image/'))
          ? 'IMAGE'
          : 'DOCUMENT'
        : 'TEXT',
      content,
      attachments,
      repliedToMessageId,
      clientMessageId: input.clientMessageId,
      readBy: [senderId],
      deliveredTo: [senderId],
    });
    const update =
      actor.role === 'customer'
        ? {
            $set: {
              lastMessage: this.preview(message),
              lastMessageAt: message.createdAt,
            },
            $inc: { shopUnreadCount: 1 },
            $pull: { archivedBy: senderId },
          }
        : {
            $set: {
              lastMessage: this.preview(message),
              lastMessageAt: message.createdAt,
            },
            $inc: { customerUnreadCount: 1 },
            $pull: { archivedBy: senderId },
          };
    await this.conversations
      .updateOne({ _id: conversation._id }, update)
      .exec();
    const populated = await this.messages
      .findById(message._id)
      .populate('senderId', 'fullName profileImageData')
      .populate('repliedToMessageId', 'content senderId isDeleted')
      .lean<ChatMessageView>()
      .exec();
    if (!populated) throw new NotFoundException('Message could not be loaded.');
    return this.messageDto(populated);
  }

  async editMessage(
    actor: ChatActor,
    messageId: string,
    content: string,
  ): Promise<ChatMessageResult> {
    const message = await this.messages.findById(messageId).exec();
    if (!message) throw new NotFoundException('Message not found.');
    await this.requireConversation(actor, message.conversationId.toString());
    if (message.senderId.toString() !== actor.userId || message.isDeleted) {
      throw new ForbiddenException(
        'You can only edit your own active messages.',
      );
    }
    const updated = await this.messages
      .findOneAndUpdate(
        {
          _id: message._id,
          senderId: this.id(actor.userId),
          isDeleted: false,
          updatedAt: message.updatedAt,
        },
        {
          $set: {
            content: content.trim(),
            isEdited: true,
            editedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        'This message changed before your edit was saved. Reload and retry.',
      );
    }
    await this.updateConversationPreview(message.conversationId);
    return this.messageDto(
      await this.messages
        .findById(message._id)
        .populate('senderId', 'fullName profileImageData')
        .populate('repliedToMessageId', 'content senderId isDeleted')
        .lean<ChatMessageView>()
        .exec(),
    );
  }

  async deleteMessage(
    actor: ChatActor,
    messageId: string,
  ): Promise<ChatDeletedMessageResult> {
    const message = await this.messages.findById(messageId).exec();
    if (!message) throw new NotFoundException('Message not found.');
    const conversation = await this.requireConversation(
      actor,
      message.conversationId.toString(),
    );
    if (message.senderId.toString() !== actor.userId) {
      throw new ForbiddenException('You can only delete your own messages.');
    }
    if (message.isDeleted) {
      return {
        id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        isDeleted: true,
        deletedAt: message.deletedAt,
        lastMessage: conversation.lastMessage ?? '',
        lastMessageAt: conversation.lastMessageAt,
      };
    }
    const deletedAt = new Date();
    const deleted = await this.messages
      .findOneAndUpdate(
        {
          _id: message._id,
          senderId: this.id(actor.userId),
          isDeleted: false,
          updatedAt: message.updatedAt,
        },
        { $set: { content: '', isDeleted: true, deletedAt } },
        { new: true },
      )
      .exec();
    if (!deleted) {
      throw new ConflictException(
        'This message changed before it could be deleted. Reload and retry.',
      );
    }
    const preview = await this.updateConversationPreview(
      message.conversationId,
    );
    return {
      id: deleted._id.toString(),
      conversationId: deleted.conversationId.toString(),
      isDeleted: true,
      deletedAt: deleted.deletedAt,
      lastMessage: preview.lastMessage,
      lastMessageAt: preview.lastMessageAt,
    };
  }

  async markRead(actor: ChatActor, conversationId: string) {
    const conversation = await this.requireConversation(actor, conversationId);
    const readerId = this.id(actor.userId);
    await this.messages
      .updateMany(
        {
          conversationId: conversation._id,
          senderId: { $ne: readerId },
          readBy: { $ne: readerId },
        },
        { $addToSet: { readBy: readerId, deliveredTo: readerId } },
      )
      .exec();
    const unreadField =
      actor.role === 'customer' ? 'customerUnreadCount' : 'shopUnreadCount';
    await this.conversations
      .updateOne({ _id: conversation._id }, { $set: { [unreadField]: 0 } })
      .exec();
    return { conversationId, readerId: actor.userId };
  }

  async markDelivered(
    actor: ChatActor,
    conversationId: string,
    messageId: string,
    recipientId: string,
  ) {
    const conversation = await this.requireConversation(actor, conversationId);
    if (
      !conversation.participants.some((id) => id.toString() === recipientId)
    ) {
      throw new ForbiddenException(
        'Delivery recipient is not in this conversation.',
      );
    }
    await this.messages
      .updateOne(
        {
          _id: this.id(messageId),
          conversationId: conversation._id,
          senderId: { $ne: this.id(recipientId) },
        },
        { $addToSet: { deliveredTo: this.id(recipientId) } },
      )
      .exec();
  }

  async setArchived(
    actor: ChatActor,
    conversationId: string,
    archived: boolean,
  ) {
    await this.requireConversation(actor, conversationId);
    const update = archived
      ? { $addToSet: { archivedBy: this.id(actor.userId) } }
      : { $pull: { archivedBy: this.id(actor.userId) } };
    await this.conversations.updateOne({ _id: conversationId }, update).exec();
    return { archived };
  }

  async uploadAttachments(
    actor: ChatActor,
    conversationId: string,
    files: Express.Multer.File[],
  ) {
    await this.requireConversation(actor, conversationId);
    if (!files.length)
      throw new BadRequestException('Select at least one file.');
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      throw new BadRequestException(
        'Each attachment must be 10 MB or smaller.',
      );
    }
    const bucket = this.bucket();
    const prepared = files.map((file) => {
      const fileName = file.originalname.replace(/[\\/\0]/g, '').trim();
      const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
      const expectedMime = ALLOWED_TYPES[extension];
      if (!file.size || !expectedMime || expectedMime !== file.mimetype) {
        throw new BadRequestException(
          `Unsupported or empty attachment: ${fileName}`,
        );
      }
      this.validateSignature(file.buffer, expectedMime, fileName);
      return { file, fileName, mimeType: expectedMime };
    });
    const uploaded: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    }> = [];
    try {
      for (const { file, fileName, mimeType } of prepared) {
        const stream = bucket.openUploadStream(fileName, {
          contentType: mimeType,
          metadata: { uploadedBy: actor.userId, conversationId },
        });
        Readable.from([file.buffer]).pipe(stream);
        await finished(stream);
        uploaded.push({
          id: stream.id.toString(),
          fileName,
          mimeType,
          fileSize: file.size,
        });
      }
    } catch (error) {
      const cleanup = await Promise.allSettled(
        uploaded.map((file) => bucket.delete(this.id(file.id))),
      );
      const failedCleanup = cleanup.filter(
        (result) => result.status === 'rejected',
      );
      if (failedCleanup.length) {
        this.logger.error(
          `Failed to clean up ${failedCleanup.length} partial chat attachment upload(s).`,
        );
      }
      throw error;
    }
    return uploaded;
  }

  async getAttachment(
    actor: ChatActor,
    conversationId: string,
    fileId: string,
  ) {
    const conversation = await this.requireConversation(actor, conversationId);
    const message = await this.messages
      .findOne({
        conversationId: conversation._id,
        'attachments.gridFsFileId': this.id(fileId),
        isDeleted: false,
      })
      .lean()
      .exec();
    if (!message) throw new NotFoundException('Attachment not found.');
    const attachment = message.attachments.find(
      (item) => item.gridFsFileId.toString() === fileId,
    );
    if (!attachment) throw new NotFoundException('Attachment not found.');
    return {
      attachment,
      stream: this.bucket().openDownloadStream(this.id(fileId)),
    };
  }

  async eligibleConversation(actor: ChatActor, conversationId: string) {
    const conversation = await this.requireConversation(actor, conversationId);
    const [repair, users] = await Promise.all([
      this.repairRequests
        .findById(conversation.repairRequestId)
        .select('appliance status repairJob')
        .lean()
        .exec(),
      this.users
        .find({ _id: { $in: [conversation.customerId, conversation.shopId] } })
        .select('fullName email profileImageData shopDetails.shopName')
        .lean()
        .exec(),
    ]);
    const customer = this.userSummary(
      users.find((user) => user._id.equals(conversation.customerId)),
    );
    const shop = this.userSummary(
      users.find((user) => user._id.equals(conversation.shopId)),
    );
    const unreadCount =
      actor.role === 'customer'
        ? conversation.customerUnreadCount
        : conversation.shopUnreadCount;
    return {
      id: conversation._id.toString(),
      customer,
      shop,
      participant: actor.role === 'customer' ? shop : customer,
      repairRequest: {
        id: conversation.repairRequestId.toString(),
        appliance: repair?.appliance ?? 'Repair request',
        status: repair?.repairJob?.status ?? repair?.status ?? 'open',
      },
      lastMessage: conversation.lastMessage ?? '',
      lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
      unreadCount,
      archived: conversation.archivedBy.some(
        (id) => id.toString() === actor.userId,
      ),
    };
  }

  private async getUploadedAttachments(
    actor: ChatActor,
    conversationId: Types.ObjectId,
    ids: string[],
  ): Promise<ChatAttachment[]> {
    if (ids.length > 5)
      throw new BadRequestException('Attach no more than 5 files.');
    const files = await this.bucket()
      .find({
        _id: { $in: ids.map((id) => this.id(id)) },
        'metadata.uploadedBy': actor.userId,
        'metadata.conversationId': conversationId.toString(),
      })
      .toArray();
    if (files.length !== ids.length) {
      throw new ForbiddenException(
        'One or more uploaded files are unavailable.',
      );
    }
    return files.map((file) => ({
      fileName: file.filename,
      mimeType: file.contentType ?? 'application/octet-stream',
      fileSize: file.length,
      gridFsFileId: file._id,
      uploadedBy: this.id(actor.userId),
      uploadedAt: file.uploadDate,
    }));
  }

  private async requireConversation(actor: ChatActor, id: string) {
    const conversation = await this.conversations.findById(id).exec();
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (
      !conversation.participants.some(
        (participant) => participant.toString() === actor.userId,
      )
    ) {
      throw new ForbiddenException(
        'You are not a participant in this conversation.',
      );
    }
    return conversation;
  }

  private async updateConversationPreview(
    conversationId: Types.ObjectId,
  ): Promise<{ lastMessage: string; lastMessageAt?: Date }> {
    const latest = await this.messages
      .findOne({ conversationId })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
    await this.conversations
      .updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessage: latest ? this.preview(latest) : '',
            lastMessageAt: latest?.createdAt,
          },
        },
      )
      .exec();
    return {
      lastMessage: latest ? this.preview(latest) : '',
      lastMessageAt: latest?.createdAt,
    };
  }

  private preview(message: ChatMessage) {
    if (message.isDeleted) return 'This message was deleted.';
    if (message.content) return message.content.slice(0, 500);
    return message.attachments[0]?.fileName ?? 'Attachment';
  }

  private messageDto(message: ChatMessageView | null): ChatMessageResult {
    if (!message) throw new NotFoundException('Message not found.');
    const sender =
      message.senderId instanceof Types.ObjectId ? null : message.senderId;
    const reply =
      message.repliedToMessageId instanceof Types.ObjectId
        ? null
        : message.repliedToMessageId;
    return {
      id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      senderId:
        message.senderId instanceof Types.ObjectId
          ? message.senderId.toString()
          : message.senderId._id.toString(),
      sender: this.userSummary(sender),
      senderRole: message.senderRole,
      messageType: message.messageType,
      content: message.isDeleted ? '' : message.content,
      attachments: message.isDeleted
        ? []
        : message.attachments.map((item) => ({
            fileName: item.fileName,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
            id: item.gridFsFileId.toString(),
            uploadedAt: item.uploadedAt,
          })),
      repliedTo: reply
        ? {
            id: reply._id.toString(),
            content: reply.isDeleted
              ? 'This message was deleted.'
              : (reply.content ?? ''),
            isDeleted: reply.isDeleted,
          }
        : null,
      clientMessageId: message.clientMessageId,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      readBy: message.readBy.map((id) => id.toString()),
      deliveredTo: message.deliveredTo.map((id) => id.toString()),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private userSummary(user: ChatUserView | Types.ObjectId | null | undefined) {
    if (!user) return { id: '', name: 'User', profileImageUrl: null };
    if (user instanceof Types.ObjectId) {
      return { id: user.toHexString(), name: 'User', profileImageUrl: null };
    }
    return {
      id: user._id.toHexString(),
      name: user.shopDetails?.shopName || user.fullName || user.email || 'User',
      profileImageUrl: this.normalizeProfileImage(user.profileImageData),
    };
  }

  private normalizeProfileImage(value?: string): string | null {
    if (!value) return null;
    if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      return `data:image/jpeg;base64,${value}`;
    }
    return null;
  }

  private repairSummary(repair: ChatRepairView | Types.ObjectId) {
    if (repair instanceof Types.ObjectId) {
      return {
        id: repair.toHexString(),
        appliance: 'Repair request',
        status: 'open',
      };
    }
    return {
      id: repair._id.toHexString(),
      appliance: repair.appliance ?? 'Repair request',
      status: repair.repairJob?.status ?? repair.status ?? 'open',
    };
  }

  private id(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid identifier.');
    }
    return new Types.ObjectId(value);
  }

  private bucket() {
    if (!this.connection.db) {
      throw new ServiceUnavailableException(
        'Chat file storage is unavailable.',
      );
    }
    return new mongo.GridFSBucket(this.connection.db, {
      bucketName: 'chatFiles',
    });
  }

  private validateSignature(bytes: Buffer, mimeType: string, fileName: string) {
    const valid =
      (mimeType === 'image/jpeg' &&
        bytes.length > 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (mimeType === 'image/png' &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mimeType === 'image/webp' &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP') ||
      (mimeType === 'application/pdf' &&
        bytes.toString('ascii', 0, 5) === '%PDF-') ||
      ((mimeType.endsWith('wordprocessingml.document') ||
        mimeType.endsWith('spreadsheetml.sheet')) &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b) ||
      ((mimeType === 'application/msword' ||
        mimeType === 'application/vnd.ms-excel') &&
        bytes.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) ||
      (mimeType === 'text/plain' &&
        !bytes.includes(0) &&
        Buffer.from(bytes.toString('utf8')).equals(bytes));
    if (!valid || bytes.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `The file ${fileName} is invalid or unsupported.`,
      );
    }
  }
}
