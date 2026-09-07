import 'reflect-metadata';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RABBIT_HANDLER } from '@golevelup/nestjs-rabbitmq';
import { of, throwError } from 'rxjs';
import { RabbitConsumerLoggingInterceptor } from './rabbit-consumer-logging.interceptor';

describe('RabbitConsumerLoggingInterceptor', () => {
  const prevPayload = process.env.LOG_RABBIT_PAYLOAD;

  afterEach(() => {
    process.env.LOG_RABBIT_PAYLOAD = prevPayload;
  });

  it('passa direto quando nao e contexto Rabbit (sem metadata no handler)', () => {
    const interceptor = new RabbitConsumerLoggingInterceptor();
    const next: CallHandler = { handle: () => of('ok') };
    const context = {
      getHandler: () =>
        function plainHandler() {
          return undefined;
        },
      getClass: () =>
        class C {
          static name = 'C';
        },
      getArgs: () => [],
    } as unknown as ExecutionContext;

    let completed = false;
    interceptor.intercept(context, next).subscribe({
      next: (v) => {
        expect(v).toBe('ok');
      },
      complete: () => {
        completed = true;
      },
    });
    expect(completed).toBe(true);
  });

  it('em contexto Rabbit completa e subscreve ao next', (done) => {
    function handleInbound() {
      return undefined;
    }
    Reflect.defineMetadata(
      RABBIT_HANDLER,
      { type: 'subscribe' },
      handleInbound,
    );

    const interceptor = new RabbitConsumerLoggingInterceptor();
    const next: CallHandler = { handle: () => of(undefined) };
    const context = {
      getHandler: () => handleInbound,
      getClass: () => class InboundConsumer {},
      getArgs: () => [{ event: true }],
    } as unknown as ExecutionContext;

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        done();
      },
      error: (err: unknown) => {
        done(err instanceof Error ? err : new Error(String(err)));
      },
    });
  });

  it('propaga erro do handler', (done) => {
    function handleInbound() {
      return undefined;
    }
    Reflect.defineMetadata(
      RABBIT_HANDLER,
      { type: 'subscribe' },
      handleInbound,
    );

    const err = new Error('handler boom');
    const interceptor = new RabbitConsumerLoggingInterceptor();
    const next: CallHandler = {
      handle: () => throwError(() => err),
    };
    const context = {
      getHandler: () => handleInbound,
      getClass: () => class InboundConsumer {},
      getArgs: () => [{}],
    } as unknown as ExecutionContext;

    interceptor.intercept(context, next).subscribe({
      next: () => {
        done(new Error('should not emit'));
      },
      error: (e: unknown) => {
        expect(e).toBe(err);
        done();
      },
    });
  });
});
