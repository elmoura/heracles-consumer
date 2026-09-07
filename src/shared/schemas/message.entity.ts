import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

@Schema({ collection: 'messages', timestamps: true })
export class MessageEntity {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  agentId: Types.ObjectId;

  @Prop({ type: String, enum: MessageDirection, required: true })
  direction: MessageDirection;

  @Prop({ required: true, trim: true })
  metaMessageId: string;

  @Prop({ trim: true })
  text?: string;

  @Prop({ trim: true })
  messageType?: string;

  @Prop()
  promptTokens?: number;

  @Prop()
  totalTokens?: number;

  createdAt: Date;
  updatedAt: Date;
}

export type MessageDocument = HydratedDocument<MessageEntity>;
export const MessageSchema = SchemaFactory.createForClass(MessageEntity);

MessageSchema.index({ organizationId: 1, metaMessageId: 1 }, { unique: true });
MessageSchema.index({ conversationId: 1, createdAt: -1 });
