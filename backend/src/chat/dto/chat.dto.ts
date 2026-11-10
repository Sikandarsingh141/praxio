import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateChatConversationDto {
  @IsMongoId()
  repairRequestId!: string;

  @IsMongoId()
  shopId!: string;
}

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsMongoId()
  repliedToMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientMessageId?: string;
}

export class EditChatMessageDto {
  @IsString()
  @Length(1, 5000)
  content!: string;
}
