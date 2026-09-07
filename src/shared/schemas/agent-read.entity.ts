import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Leitura apenas — coleção `agents` partilhada com hermes-api. */
@Schema({ collection: 'agents', timestamps: false })
export class AgentReadEntity {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  whatsappPhone: string;

  @Prop({ required: true })
  prompt: string;
}

export type AgentReadDocument = HydratedDocument<AgentReadEntity>;
export const AgentReadSchema = SchemaFactory.createForClass(AgentReadEntity);
