import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MessageInboundV1 } from '@/shared/contracts/message-inbound.v1';
import { KnowledgeRetriever } from '@/shared/ai/knowledge-retriever';
import { ContextBuilder, type ChatTurn } from '@/shared/ai/context-builder';
import { LlmClient } from '@/shared/ai/llm-client';
import { WhatsappGraphService } from '@/shared/ai/whatsapp-graph.service';
import {
  AgentReadEntity,
  type AgentReadDocument,
} from '@/shared/schemas/agent-read.entity';
import {
  OrganizationReadEntity,
  type OrganizationReadDocument,
} from '@/shared/schemas/organization-read.entity';
import {
  ContactEntity,
  type ContactDocument,
} from '@/shared/schemas/contact.entity';
import {
  ConversationEntity,
  ConversationStatus,
  type ConversationDocument,
} from '@/shared/schemas/conversation.entity';
import {
  MessageDirection,
  MessageEntity,
  type MessageDocument,
} from '@/shared/schemas/message.entity';
import { config } from '@/config/config';
import { formatBusinessContextLines } from '@/shared/ai/format-business-context';
import { valueToToon } from '@/shared/ai/toon';
import { RealtimeEventsPublisherService } from '@/shared/rabbit/realtime-events-publisher.service';
import { randomUUID } from 'node:crypto';
import { isMongoDuplicateKey } from '@/shared/utils/mongo-errors';
import { normalizeWaId } from '../inbound.utils';

@Injectable()
export class ProcessAiReplyUsecase {
  private readonly logger = new Logger(ProcessAiReplyUsecase.name);

  constructor(
    @InjectModel(AgentReadEntity.name)
    private readonly agentModel: Model<AgentReadDocument>,
    @InjectModel(OrganizationReadEntity.name)
    private readonly organizationModel: Model<OrganizationReadDocument>,
    @InjectModel(ContactEntity.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(ConversationEntity.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(MessageEntity.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly knowledge: KnowledgeRetriever,
    private readonly contextBuilder: ContextBuilder,
    private readonly llm: LlmClient,
    private readonly whatsapp: WhatsappGraphService,
    private readonly realtimePublisher: RealtimeEventsPublisherService,
  ) {}

  async execute(event: MessageInboundV1): Promise<void> {
    const organizationId = new Types.ObjectId(event.organizationId);
    const agentId = new Types.ObjectId(event.agentId);
    const waId = normalizeWaId(event.fromWaId);

    const [agent, org] = await Promise.all([
      this.agentModel.findOne({
        _id: agentId,
        organizationId,
      }),
      this.organizationModel.findById(organizationId),
    ]);

    if (!agent) {
      throw new Error(`Agente ${event.agentId} não encontrado no tenant.`);
    }
    if (!org?.whatsappBusinessToken?.trim()) {
      throw new Error(
        `Organização ${event.organizationId} sem whatsappBusinessToken.`,
      );
    }

    const contact = await this.contactModel.findOne({ organizationId, waId });
    if (!contact) {
      throw new Error('Contact não encontrado após persist; requeue sugerido.');
    }

    const conversation = await this.conversationModel.findOne({
      organizationId,
      agentId,
      contactId: contact._id,
    });
    if (!conversation) {
      throw new Error(
        'Conversation não encontrada após persist; requeue sugerido.',
      );
    }

    const inboundExists = await this.messageModel.findOne({
      organizationId,
      conversationId: conversation._id,
      metaMessageId: event.metaMessageId,
      direction: MessageDirection.INBOUND,
    });
    if (!inboundExists) {
      throw new Error(
        'Mensagem inbound não encontrada após persist; requeue sugerido.',
      );
    }

    const historyDocs = await this.messageModel
      .find({
        organizationId,
        conversationId: conversation._id,
      })
      .sort({ createdAt: 1 })
      .limit(config.context.maxMessages)
      .exec();

    const history: ChatTurn[] = [];
    for (const m of historyDocs) {
      if (
        m.metaMessageId === event.metaMessageId &&
        m.direction === MessageDirection.INBOUND
      ) {
        continue;
      }
      if (m.direction === MessageDirection.INBOUND) {
        history.push({ role: 'user', content: m.text ?? '' });
      } else {
        history.push({ role: 'assistant', content: m.text ?? '' });
      }
    }

    const knowledgeSnippets = await this.knowledge.retrieve({
      organizationId: event.organizationId,
      agentId: event.agentId,
      conversationId: conversation._id.toString(),
      query: event.text ?? '',
    });

    const businessContextText =
      formatBusinessContextLines(org.businessContext) ||
      config.context.businessContextStub ||
      '';

    const sessionStateToon = valueToToon({
      conversationId: conversation._id.toString(),
      status: conversation.status,
      historyTurns: history.length,
    });
    const catalogSliceToon = valueToToon(
      knowledgeSnippets.map((snippet, index) => ({
        rank: index + 1,
        snippet,
      })),
    );

    const built = this.contextBuilder.build({
      businessName:
        (org?.toObject() as OrganizationReadEntity).name ?? 'Undefined',
      organizationId: event.organizationId,
      agentId: event.agentId,
      conversationId: conversation._id,
      agentPrompt: agent.prompt,
      knowledgeSnippets,
      history,
      latestUserText: event.text ?? '',
      businessContextText,
      catalogSliceToon,
      sessionStateToon,
    });

    const reply = await this.llm.generateReply(built);

    if (reply.requiresHumanIntervention) {
      await this.conversationModel.updateOne(
        { _id: conversation._id },
        {
          $set: {
            status: ConversationStatus.PAUSED_FOR_HUMAN_INTERVENTION,
            updatedAt: new Date(),
          },
        },
      );
    }

    await this.whatsapp.sendText({
      accessToken: org.whatsappBusinessToken,
      phoneNumberId: event.metaPhoneNumberId,
      toWaId: event.fromWaId,
      body: reply.userMessage,
    });

    const outboundMetaId = `local-out-${event.eventId}`;
    try {
      const created = await this.messageModel.create({
        organizationId,
        conversationId: conversation._id,
        agentId,
        direction: MessageDirection.OUTBOUND,
        metaMessageId: outboundMetaId,
        text: reply.userMessage,
        messageType: 'text',
        promptTokens: reply.usage?.promptTokens,
        totalTokens: reply.usage?.totalTokens,
      });
      const realtimeEventId = randomUUID();
      try {
        await this.realtimePublisher.publish({
          schemaVersion: 'realtime.event.v1',
          eventId: realtimeEventId,
          eventName: 'message-created',
          occurredAt: created.createdAt.toISOString(),
          organizationId: event.organizationId,
          agentId: event.agentId,
          conversationId: conversation._id.toString(),
          messageId: created._id.toString(),
          direction: 'outbound',
        });
      } catch (publishError: unknown) {
        this.logger.error(
          JSON.stringify({
            msg: 'ai_outbound_realtime_publish_failed',
            organizationId: event.organizationId,
            agentId: event.agentId,
            conversationId: conversation._id.toString(),
            messageId: created._id.toString(),
            eventId: realtimeEventId,
            error:
              publishError instanceof Error
                ? publishError.message
                : String(publishError),
          }),
        );
      }
    } catch (e: unknown) {
      if (isMongoDuplicateKey(e)) {
        this.logger.log(
          JSON.stringify({
            msg: 'realtime_event_skipped_deduplicated',
            eventName: 'message-created',
            organizationId: event.organizationId,
            conversationId: conversation._id.toString(),
            idempotencyKey: outboundMetaId,
          }),
        );
        return;
      }
      this.logger.warn(`Falha ao gravar outbound: ${String(e)}`);
    }

    this.logger.log(
      JSON.stringify({
        msg: 'ai_reply_ok',
        organizationId: event.organizationId,
        conversationId: conversation._id.toString(),
        metaMessageId: event.metaMessageId,
        requiresHumanIntervention: reply.requiresHumanIntervention,
      }),
    );
  }
}
