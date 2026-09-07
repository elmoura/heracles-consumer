import { MESSAGE_INBOUND_SCHEMA_VERSION } from '@/shared/contracts/message-inbound.v1';
import type { PersistInboundMessageUsecase } from './usecases/persist-inbound-message.usecase';
import type { ProcessAiReplyUsecase } from './usecases/process-ai-reply.usecase';
import { InboundConsumer } from './inbound.consumer';

describe('InboundConsumer', () => {
  const event = {
    schemaVersion: MESSAGE_INBOUND_SCHEMA_VERSION,
    eventId: 'evt-1',
    organizationId: '507f1f77bcf86cd799439011',
    agentId: '507f1f77bcf86cd799439012',
    metaPhoneNumberId: 'phone-1',
    metaMessageId: 'meta-1',
    fromWaId: '5511999999999',
    timestampIso: new Date().toISOString(),
    messageType: 'text',
    text: 'ola',
    rawMessage: {},
  };

  it('handleInbound chama persist e depois IA na ordem', async () => {
    const persist = {
      execute: jest.fn().mockResolvedValue({ inboundCreated: true }),
    };
    const ai = { execute: jest.fn().mockResolvedValue(undefined) };
    const c = new InboundConsumer(
      persist as unknown as PersistInboundMessageUsecase,
      ai as unknown as ProcessAiReplyUsecase,
    );
    await c.handleInbound(event);
    expect(persist.execute).toHaveBeenCalledWith(event);
    expect(ai.execute).toHaveBeenCalledWith(event);
    expect(persist.execute.mock.invocationCallOrder[0]).toBeLessThan(
      ai.execute.mock.invocationCallOrder[0],
    );
  });

  it('nao chama use cases se payload invalido', async () => {
    const persist = { execute: jest.fn() };
    const ai = { execute: jest.fn() };
    const c = new InboundConsumer(
      persist as unknown as PersistInboundMessageUsecase,
      ai as unknown as ProcessAiReplyUsecase,
    );
    await c.handleInbound({ invalid: true });
    expect(persist.execute).not.toHaveBeenCalled();
    expect(ai.execute).not.toHaveBeenCalled();
  });

  it('aceita envelope com data em string JSON e persiste inbound', async () => {
    const persist = {
      execute: jest.fn().mockResolvedValue({ inboundCreated: true }),
    };
    const ai = { execute: jest.fn().mockResolvedValue(undefined) };
    const c = new InboundConsumer(
      persist as unknown as PersistInboundMessageUsecase,
      ai as unknown as ProcessAiReplyUsecase,
    );
    await c.handleInbound({
      pattern: 'message.inbound.v1',
      data: JSON.stringify(event),
    });
    expect(persist.execute).toHaveBeenCalledWith(event);
    expect(ai.execute).toHaveBeenCalledWith(event);
  });

  it('aceita envelope com data em Buffer JSON e persiste inbound', async () => {
    const persist = {
      execute: jest.fn().mockResolvedValue({ inboundCreated: true }),
    };
    const ai = { execute: jest.fn().mockResolvedValue(undefined) };
    const c = new InboundConsumer(
      persist as unknown as PersistInboundMessageUsecase,
      ai as unknown as ProcessAiReplyUsecase,
    );
    await c.handleInbound({
      pattern: 'message.inbound.v1',
      data: Buffer.from(JSON.stringify(event), 'utf8'),
    });
    expect(persist.execute).toHaveBeenCalledWith(event);
    expect(ai.execute).toHaveBeenCalledWith(event);
  });

  it('não chama IA quando inbound foi deduplicada', async () => {
    const persist = {
      execute: jest.fn().mockResolvedValue({ inboundCreated: false }),
    };
    const ai = { execute: jest.fn().mockResolvedValue(undefined) };
    const c = new InboundConsumer(
      persist as unknown as PersistInboundMessageUsecase,
      ai as unknown as ProcessAiReplyUsecase,
    );
    await c.handleInbound(event);
    expect(persist.execute).toHaveBeenCalledWith(event);
    expect(ai.execute).not.toHaveBeenCalled();
  });
});
