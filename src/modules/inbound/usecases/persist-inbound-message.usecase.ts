import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MessageInboundV1 } from '@/shared/contracts/message-inbound.v1';
import {
  ConversationEntity,
  ConversationStatus,
  type ConversationDocument,
} from '@/shared/schemas/conversation.entity';
import {
  ContactEntity,
  type ContactDocument,
} from '@/shared/schemas/contact.entity';
import {
  MessageDirection,
  MessageEntity,
  type MessageDocument,
} from '@/shared/schemas/message.entity';
import { isMongoDuplicateKey } from '@/shared/utils/mongo-errors';
import { randomUUID } from 'node:crypto';
import { RealtimeEventsPublisherService } from '@/shared/rabbit/realtime-events-publisher.service';
import { normalizeWaId } from '../inbound.utils';

@Injectable()
export class PersistInboundMessageUsecase {
  private readonly logger = new Logger(PersistInboundMessageUsecase.name);

  constructor(
    @InjectModel(ContactEntity.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(ConversationEntity.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(MessageEntity.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly realtimePublisher: RealtimeEventsPublisherService,
  ) {}

  async execute(
    event: MessageInboundV1,
  ): Promise<{ conversationId: string; inboundCreated: boolean }> {
    const organizationId = new Types.ObjectId(event.organizationId);
    const agentId = new Types.ObjectId(event.agentId);
    const waId = normalizeWaId(event.fromWaId);

    const contact = await this.upsertContact(
      organizationId,
      waId,
      event.contactName,
    );
    const { conversation, created: conversationCreated } =
      await this.upsertConversation(organizationId, agentId, contact._id);
    if (conversationCreated) {
      await this.realtimePublisher.publish({
        schemaVersion: 'realtime.event.v1',
        eventId: randomUUID(),
        eventName: 'conversation-created',
        occurredAt: new Date().toISOString(),
        organizationId: event.organizationId,
        agentId: event.agentId,
        conversationId: conversation._id.toString(),
      });
    }

    let inboundCreated = false;
    try {
      const created = await this.messageModel.create({
        organizationId,
        conversationId: conversation._id,
        agentId,
        direction: MessageDirection.INBOUND,
        metaMessageId: event.metaMessageId,
        text: event.text,
        messageType: event.messageType,
      });
      inboundCreated = true;
      await this.realtimePublisher.publish({
        schemaVersion: 'realtime.event.v1',
        eventId: randomUUID(),
        eventName: 'message-created',
        occurredAt: created.createdAt.toISOString(),
        organizationId: event.organizationId,
        agentId: event.agentId,
        conversationId: conversation._id.toString(),
        messageId: created._id.toString(),
        direction: 'inbound',
      });
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        const existing = await this.messageModel
          .findOne({
            organizationId,
            metaMessageId: event.metaMessageId,
          })
          .exec();
        this.logger.debug(
          `Idempotência: mensagem ${event.metaMessageId} já persistida.`,
        );
        if (
          existing?.direction &&
          existing.direction !== MessageDirection.INBOUND
        ) {
          this.logger.warn(
            JSON.stringify({
              msg: 'inbound_deduplicated_with_non_inbound_existing',
              organizationId: event.organizationId,
              metaMessageId: event.metaMessageId,
              existingDirection: existing.direction,
            }),
          );
        }
        this.logger.log(
          JSON.stringify({
            msg: 'realtime_event_skipped_deduplicated',
            eventName: 'message-created',
            organizationId: event.organizationId,
            metaMessageId: event.metaMessageId,
            existingDirection: existing?.direction ?? null,
          }),
        );
        return {
          conversationId: conversation._id.toString(),
          inboundCreated: false,
        };
      }
      throw err;
    }

    const preview = (event.text ?? '').slice(0, 200);
    await this.conversationModel.updateOne(
      { _id: conversation._id },
      { $set: { lastMessagePreview: preview, updatedAt: new Date() } },
    );

    this.logger.log(
      JSON.stringify({
        msg: 'persist_inbound_ok',
        organizationId: event.organizationId,
        conversationId: conversation._id.toString(),
        metaMessageId: event.metaMessageId,
        inboundCreated,
      }),
    );

    return {
      conversationId: conversation._id.toString(),
      inboundCreated: true,
    };
  }

  private async upsertContact(
    organizationId: Types.ObjectId,
    waId: string,
    displayName?: string,
  ): Promise<ContactDocument> {
    const existing = await this.contactModel.findOne({ organizationId, waId });
    if (existing) {
      if (displayName && !existing.displayName) {
        existing.displayName = displayName;
        await existing.save();
      }
      return existing;
    }
    return this.contactModel.create({
      organizationId,
      waId,
      displayName,
    });
  }

  private async upsertConversation(
    organizationId: Types.ObjectId,
    agentId: Types.ObjectId,
    contactId: Types.ObjectId,
  ): Promise<{ conversation: ConversationDocument; created: boolean }> {
    const existing = await this.conversationModel.findOne({
      organizationId,
      agentId,
      contactId,
    });
    if (existing) {
      return { conversation: existing, created: false };
    }
    try {
      const created = await this.conversationModel.create({
        organizationId,
        agentId,
        contactId,
        status: ConversationStatus.OPEN,
      });
      return { conversation: created, created: true };
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        const again = await this.conversationModel.findOne({
          organizationId,
          agentId,
          contactId,
        });
        if (again) {
          return { conversation: again, created: false };
        }
      }
      throw err;
    }
  }
}
