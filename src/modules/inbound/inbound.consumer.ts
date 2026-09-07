import { Injectable, Logger, UseInterceptors } from '@nestjs/common';
import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import { config } from '@/config/config';
import { RabbitConsumerLoggingInterceptor } from '@/shared/rabbit/rabbit-consumer-logging.interceptor';
import { parseInboundPayload } from './parse-inbound-payload';
import { PersistInboundMessageUsecase } from './usecases/persist-inbound-message.usecase';
import { ProcessAiReplyUsecase } from './usecases/process-ai-reply.usecase';

@Injectable()
@UseInterceptors(RabbitConsumerLoggingInterceptor)
export class InboundConsumer {
  private readonly logger = new Logger(InboundConsumer.name);

  constructor(
    private readonly persistInboundMessage: PersistInboundMessageUsecase,
    private readonly processAiReply: ProcessAiReplyUsecase,
  ) {}

  @RabbitSubscribe({
    exchange: config.rabbitmq.inboundExchange,
    routingKey: '',
    queue: config.rabbitmq.inboundPipelineQueue,
    queueOptions: { durable: true },
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  async handleInbound(msg: unknown): Promise<void> {
    const event = parseInboundPayload(msg);
    if (!event) {
      this.logger.warn(
        `Inbound: payload inválido — ack implícito. shape=${this.describeShape(msg)}`,
      );
      return;
    }
    const persisted = await this.persistInboundMessage.execute(event);
    if (!persisted.inboundCreated) {
      this.logger.log(
        `Inbound deduplicada; resposta IA ignorada. metaMessageId=${event.metaMessageId}`,
      );
      return;
    }
    await this.processAiReply.execute(event);
  }

  private describeShape(input: unknown): string {
    if (Buffer.isBuffer(input)) {
      return 'buffer';
    }
    if (typeof input === 'string') {
      return 'string';
    }
    if (!input || typeof input !== 'object') {
      return typeof input;
    }
    const obj = input as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const data = obj.data;
    let dataType = 'none';
    if (Buffer.isBuffer(data)) {
      dataType = 'buffer';
    } else if (data !== undefined) {
      dataType = typeof data;
    }
    return `object(keys=${keys.join(',')};dataType=${dataType})`;
  }
}
