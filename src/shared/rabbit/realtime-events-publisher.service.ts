import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  buildRealtimeRoutingKey,
  type RealtimeEventV1,
} from '@/shared/contracts/realtime-event.v1';
import { config } from '@/config/config';
import { REALTIME_EVENTS_CLIENT } from './realtime.constants';

@Injectable()
export class RealtimeEventsPublisherService {
  private readonly logger = new Logger(RealtimeEventsPublisherService.name);

  constructor(
    @Inject(REALTIME_EVENTS_CLIENT) private readonly client: ClientProxy,
  ) {}

  get enabled(): boolean {
    return Boolean(config.rabbitmq.url?.trim());
  }

  async publish(event: RealtimeEventV1): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const routingKey = buildRealtimeRoutingKey(event);
    try {
      await firstValueFrom(this.client.emit(routingKey, event));
      this.logger.log(
        JSON.stringify({
          msg: 'realtime_event_published',
          exchange: config.rabbitmq.realtimeExchange,
          routingKey,
          eventName: event.eventName,
          organizationId: event.organizationId,
          conversationId: event.conversationId,
          messageId: 'messageId' in event ? event.messageId : undefined,
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          msg: 'realtime_event_publish_error',
          exchange: config.rabbitmq.realtimeExchange,
          routingKey,
          eventName: event.eventName,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    }
  }
}
