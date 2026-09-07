import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { isRabbitContext } from '@golevelup/nestjs-rabbitmq';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { config } from '@/config/config';
import { safeSerializePayload } from './payload-log.redact';

function queueLabelForHandler(handlerName: string): string {
  switch (handlerName) {
    case 'handleInbound':
      return config.rabbitmq.inboundPipelineQueue;
    default:
      return handlerName;
  }
}

type AmqpLikeFields = {
  routingKey?: string;
  exchange?: string;
};

type AmqpLikeMessage = {
  properties?: { messageId?: string };
  fields?: AmqpLikeFields;
};

function summarizeAmqpEnvelope(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const m = raw as AmqpLikeMessage;
  const messageId =
    typeof m.properties?.messageId === 'string'
      ? m.properties.messageId
      : undefined;
  const routingKey =
    typeof m.fields?.routingKey === 'string' ? m.fields.routingKey : undefined;
  const exchange =
    typeof m.fields?.exchange === 'string' ? m.fields.exchange : undefined;
  if (!messageId && !routingKey && !exchange) {
    return null;
  }
  return {
    ...(messageId !== undefined ? { messageId } : {}),
    ...(routingKey !== undefined ? { routingKey } : {}),
    ...(exchange !== undefined ? { exchange } : {}),
  };
}

@Injectable()
export class RabbitConsumerLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RabbitConsumer');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isRabbitContext(context)) {
      return next.handle();
    }

    const handlerFn = context.getHandler();
    const className = context.getClass().name;
    const handlerName =
      typeof handlerFn === 'function' && handlerFn.name
        ? handlerFn.name
        : 'unknown';
    const queue = queueLabelForHandler(handlerName);
    const argsUnknown: unknown[] = context.getArgs();
    const payload: unknown = argsUnknown[0];
    const rawAmqp: unknown = argsUnknown[1];
    const headers: unknown = argsUnknown[2];

    const logPayload = process.env.LOG_RABBIT_PAYLOAD === 'true';
    const start = Date.now();
    const scope = `${className}.${handlerName}`;

    const envelope = summarizeAmqpEnvelope(rawAmqp);
    if (logPayload) {
      this.logger.log(
        `RMQ in queue=${queue} handler=${scope} payload=${safeSerializePayload(payload)}` +
          (envelope ? ` envelope=${JSON.stringify(envelope)}` : '') +
          (headers != null && typeof headers === 'object'
            ? ` headers=${safeSerializePayload(headers)}`
            : ''),
      );
    } else {
      const preview =
        payload !== null &&
        payload !== undefined &&
        typeof payload === 'object' &&
        !Buffer.isBuffer(payload)
          ? `keys=${Object.keys(payload as Record<string, unknown>)
              .slice(0, 12)
              .join(',')}`
          : `type=${typeof payload}`;
      this.logger.log(
        `RMQ in queue=${queue} handler=${scope} ${preview}` +
          (envelope ? ` envelope=${JSON.stringify(envelope)}` : ''),
      );
    }

    return next.handle().pipe(
      tap({
        complete: () => {
          const ms = Date.now() - start;
          this.logger.log(`RMQ ok queue=${queue} handler=${scope} ${ms}ms`);
        },
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(
          `RMQ fail queue=${queue} handler=${scope} ${ms}ms ${message}`,
          stack,
        );
        return throwError(() => err);
      }),
    );
  }
}
