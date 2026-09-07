import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { config } from '@/config/config';
import {
  AgentReadEntity,
  AgentReadSchema,
} from '@/shared/schemas/agent-read.entity';
import {
  OrganizationReadEntity,
  OrganizationReadSchema,
} from '@/shared/schemas/organization-read.entity';
import { ContactEntity, ContactSchema } from '@/shared/schemas/contact.entity';
import {
  ConversationEntity,
  ConversationSchema,
} from '@/shared/schemas/conversation.entity';
import { MessageEntity, MessageSchema } from '@/shared/schemas/message.entity';
import { KnowledgeRetriever } from '@/shared/ai/knowledge-retriever';
import { MistralEmbeddingsService } from '@/shared/ai/mistral-embeddings.service';
import { ContextBuilder } from '@/shared/ai/context-builder';
import { LlmClient } from '@/shared/ai/llm-client';
import { WhatsappGraphService } from '@/shared/ai/whatsapp-graph.service';
import { InboundConsumer } from './inbound.consumer';
import { PersistInboundMessageUsecase } from './usecases/persist-inbound-message.usecase';
import { ProcessAiReplyUsecase } from './usecases/process-ai-reply.usecase';
import { RabbitConsumerLoggingInterceptor } from '@/shared/rabbit/rabbit-consumer-logging.interceptor';
import { REALTIME_EVENTS_CLIENT } from '@/shared/rabbit/realtime.constants';
import { RealtimeEventsPublisherService } from '@/shared/rabbit/realtime-events-publisher.service';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri: config.rabbitmq.url || 'amqp://127.0.0.1',
      exchanges: [
        {
          name: config.rabbitmq.inboundExchange,
          type: 'fanout',
          options: { durable: true },
        },
      ],
      connectionInitOptions: { wait: false },
    }),
    ClientsModule.registerAsync([
      {
        name: REALTIME_EVENTS_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmq.url],
            queue: config.rabbitmq.realtimeExchange,
            exchange: config.rabbitmq.realtimeExchange,
            exchangeType: 'topic',
            persistent: true,
          },
        }),
      },
    ]),
    MongooseModule.forFeature([
      { name: ContactEntity.name, schema: ContactSchema },
      { name: ConversationEntity.name, schema: ConversationSchema },
      { name: MessageEntity.name, schema: MessageSchema },
      { name: AgentReadEntity.name, schema: AgentReadSchema },
      { name: OrganizationReadEntity.name, schema: OrganizationReadSchema },
    ]),
  ],
  providers: [
    RabbitConsumerLoggingInterceptor,
    RealtimeEventsPublisherService,
    PersistInboundMessageUsecase,
    ProcessAiReplyUsecase,
    MistralEmbeddingsService,
    KnowledgeRetriever,
    ContextBuilder,
    LlmClient,
    WhatsappGraphService,
    InboundConsumer,
  ],
})
export class InboundModule {}
