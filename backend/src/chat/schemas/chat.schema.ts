import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'chat_conversations',
  timestamps: true,
  versionKey: false,
})
export class ChatConversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  shopId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'RepairRequest',
    required: true,
    index: true,
  })
  repairRequestId!: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participants!: Types.ObjectId[];

  @Prop({ type: String, maxlength: 500 })
  lastMessage?: string;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({ type: Number, min: 0, default: 0 })
  customerUnreadCount!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  shopUnreadCount!: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  archivedBy!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type ChatConversationDocument = HydratedDocument<ChatConversation>;
export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);
ChatConversationSchema.index(
  { repairRequestId: 1, customerId: 1, shopId: 1 },
  { unique: true, name: 'UQ_chat_conversation_repair_customer_shop' },
);
ChatConversationSchema.index({ participants: 1, lastMessageAt: -1 });

@Schema({ _id: false })
export class ChatAttachment {
  @Prop({ type: String, required: true, maxlength: 255 })
  fileName!: string;

  @Prop({ type: String, required: true, maxlength: 100 })
  mimeType!: string;

  @Prop({ type: Number, required: true, min: 1 })
  fileSize!: number;

  @Prop({ type: Types.ObjectId, required: true })
  gridFsFileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  uploadedAt!: Date;
}

export const ChatAttachmentSchema =
  SchemaFactory.createForClass(ChatAttachment);

@Schema({ collection: 'chat_messages', timestamps: true, versionKey: false })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: ChatConversation.name, required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId!: Types.ObjectId;

  @Prop({ type: String, enum: ['customer', 'shop'], required: true })
  senderRole!: 'customer' | 'shop';

  @Prop({ type: String, enum: ['TEXT', 'IMAGE', 'DOCUMENT'], required: true })
  messageType!: 'TEXT' | 'IMAGE' | 'DOCUMENT';

  @Prop({ type: String, trim: true, maxlength: 5000, default: '' })
  content!: string;

  @Prop({ type: [ChatAttachmentSchema], default: [] })
  attachments!: ChatAttachment[];

  @Prop({ type: Types.ObjectId, ref: ChatMessage.name })
  repliedToMessageId?: Types.ObjectId;

  @Prop({ type: String, maxlength: 100 })
  clientMessageId?: string;

  @Prop({ type: Boolean, default: false })
  isEdited!: boolean;

  @Prop({ type: Date })
  editedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  deliveredTo!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
ChatMessageSchema.index(
  { conversationId: 1, senderId: 1, readBy: 1 },
  { name: 'IX_chat_unread_messages' },
);
ChatMessageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } },
    name: 'UQ_chat_message_client_id',
  },
);
