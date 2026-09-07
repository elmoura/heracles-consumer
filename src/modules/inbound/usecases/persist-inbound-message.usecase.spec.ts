import { Types } from 'mongoose';
import { PersistInboundMessageUsecase } from './persist-inbound-message.usecase';
import { MessageDirection } from '@/shared/schemas/message.entity';
import { RealtimeEventsPublisherService } from '@/shared/rabbit/realtime-events-publisher.service';

describe('PersistInboundMessageUsecase', () => {
  const contactModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const conversationModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  };
  const messageModel = {
    create: jest.fn(),
    findOne: jest.fn(),
  };
  const realtimePublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const now = new Date('2026-04-10T10:00:00.000Z');
  const event = {
    schemaVersion: 'message.inbound.v1' as const,
    eventId: 'evt-1',
    organizationId: new Types.ObjectId().toString(),
    agentId: new Types.ObjectId().toString(),
    metaPhoneNumberId: 'phone-1',
    metaMessageId: 'meta-1',
    fromWaId: '5511999999999',
    timestampIso: now.toISOString(),
    messageType: 'text' as const,
    text: 'oi',
    rawMessage: {},
  };

  let usecase: PersistInboundMessageUsecase;

  beforeEach(() => {
    jest.clearAllMocks();
    const contactId = new Types.ObjectId();
    const conversationId = new Types.ObjectId();
    contactModel.findOne.mockResolvedValue(null);
    contactModel.create.mockResolvedValue({ _id: contactId });
    conversationModel.findOne.mockResolvedValue(null);
    conversationModel.create.mockResolvedValue({ _id: conversationId });
    conversationModel.updateOne.mockResolvedValue(undefined);
    messageModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      createdAt: now,
    });
    messageModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    usecase = new PersistInboundMessageUsecase(
      contactModel as never,
      conversationModel as never,
      messageModel as never,
      realtimePublisher as unknown as RealtimeEventsPublisherService,
    );
  });

  it('publica conversation-created e message-created no fluxo novo', async () => {
    const result = await usecase.execute(event);
    expect(result.inboundCreated).toBe(true);
    expect(realtimePublisher.publish).toHaveBeenCalledTimes(2);
    expect(realtimePublisher.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        schemaVersion: 'realtime.event.v1',
        eventName: 'conversation-created',
      }),
    );
    expect(realtimePublisher.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        schemaVersion: 'realtime.event.v1',
        eventName: 'message-created',
        direction: MessageDirection.INBOUND,
      }),
    );
  });

  it('não publica message-created quando inbound é deduplicada', async () => {
    const duplicate = { code: 11000 };
    messageModel.create.mockRejectedValue(duplicate);
    messageModel.findOne.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ direction: MessageDirection.INBOUND }),
    });
    const result = await usecase.execute(event);
    expect(result.inboundCreated).toBe(false);
    expect(realtimePublisher.publish).toHaveBeenCalledTimes(1);
    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'conversation-created',
      }),
    );
  });
});
