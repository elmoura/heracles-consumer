import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
class OrganizationBusinessContextRead {
  @Prop({ trim: true })
  tone?: string;

  @Prop({ trim: true })
  policies?: string;

  @Prop({ trim: true })
  hours?: string;

  @Prop({ trim: true })
  workingDays?: string;

  @Prop({ trim: true })
  limits?: string;
}

export class OrganizationWhatsappNumberEntity {
  @Prop({ required: true, trim: true })
  metaPhoneNumberId: string;

  @Prop({ required: true, trim: true })
  displayPhoneNumber: string;

  @Prop({ trim: true })
  verifiedName?: string;

  @Prop({ trim: true })
  qualityRating?: string;

  @Prop({ trim: true })
  codeVerificationStatus?: string;

  @Prop({ trim: true })
  nameStatus?: string;
}

export enum OrganizationPlanTypes {
  STARTER = 'starter',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

/** Token Meta para envio Cloud API — coleção `organizations`. */
@Schema({ collection: 'organizations', timestamps: false })
export class OrganizationReadEntity {
  /** Espelha campos M1-36 no hermes-api (read model para o bloco NEGÓCIO). */
  @Prop({ type: OrganizationBusinessContextRead, required: false })
  businessContext?: OrganizationBusinessContextRead;

  @Prop({ required: true })
  name: string;

  /** Segmento de negócio (texto livre curto). */
  @Prop({ trim: true, maxlength: 200 })
  businessSegment?: string;

  @Prop()
  ownerId?: string;

  @Prop({
    required: true,
    enum: OrganizationPlanTypes,
  })
  planType: OrganizationPlanTypes;

  @Prop()
  facebookBusinessId?: string;

  /** Token de acesso Meta (Graph / WhatsApp Cloud API); nunca expor em DTOs de leitura. */
  @Prop()
  whatsappBusinessToken?: string;

  /** Valor de `token_type` na última troca OAuth (ex.: bearer). */
  @Prop()
  metaTokenType?: string;

  @Prop()
  tokenExpiresAt?: Date;

  @Prop()
  tokenLastRefreshedAt?: Date;

  @Prop({ type: [OrganizationWhatsappNumberEntity], default: [] })
  whatsappNumbers?: OrganizationWhatsappNumberEntity[];
}

export type OrganizationReadDocument = HydratedDocument<OrganizationReadEntity>;
export const OrganizationReadSchema = SchemaFactory.createForClass(
  OrganizationReadEntity,
);
