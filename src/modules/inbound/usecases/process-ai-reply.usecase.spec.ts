import { Types } from 'mongoose';
import { ProcessAiReplyUsecase } from './process-ai-reply.usecase';
import { MessageDirection } from '@/shared/schemas/message.entity';
import { ConversationStatus } from '@/shared/schemas/conversation.entity';
import { RealtimeEventsPublisherService } from '@/shared/rabbit/realtime-events-publisher.service';

describe('ProcessAiReplyUsecase', () => {
  const orgId = new Types.ObjectId();
  const agentId = new Types.ObjectId();
  const contactId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();
  const outboundId = new Types.ObjectId();
  const now = new Date('2026-04-20T12:00:00.000Z');

  const agentModel = { findOne: jest.fn() };
  const organizationModel = { findById: jest.fn() };
  const contactModel = { findOne: jest.fn() };
  const conversationModel = { findOne: jest.fn(), updateOne: jest.fn() };
  const messageModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };
  const knowledge = { retrieve: jest.fn() };
  const contextBuilder = { build: jest.fn() };
  const llm = { generateReply: jest.fn() };
  const whatsapp = { sendText: jest.fn() };
  const realtimePublisher = { publish: jest.fn() };

  const inboundEvent = {
    schemaVersion: 'message.inbound.v1' as const,
    eventId: 'evt-1',
    organizationId: orgId.toString(),
    agentId: agentId.toString(),
    metaPhoneNumberId: 'phone-1',
    metaMessageId: 'meta-in-1',
    fromWaId: '5511999999999',
    timestampIso: now.toISOString(),
    messageType: 'text',
    text: 'quais sao os modelos de camisa polo?',
    rawMessage: {},
  };

  const makeHistoryQuery = (
    docs: Array<{ direction: MessageDirection; text: string }>,
  ) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(docs),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    agentModel.findOne.mockResolvedValue({
      _id: agentId,
      prompt: 'prompt-agent',
    });
    organizationModel.findById.mockResolvedValue({
      _id: orgId,
      name: 'Loja X',
      whatsappBusinessToken: 'token',
      businessContext: [],
      toObject: () => ({ name: 'Loja X' }),
    });
    contactModel.findOne.mockResolvedValue({ _id: contactId });
    conversationModel.findOne.mockResolvedValue({
      _id: conversationId,
      status: ConversationStatus.OPEN,
    });
    messageModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      direction: MessageDirection.INBOUND,
    });
    messageModel.find.mockReturnValue(
      makeHistoryQuery([{ direction: MessageDirection.INBOUND, text: 'oi' }]),
    );
    knowledge.retrieve.mockResolvedValue(['catálogo: camisa polo']);
    contextBuilder.build.mockReturnValue({ messages: [] });
    llm.generateReply.mockResolvedValue({
      requiresHumanIntervention: false,
      userMessage: 'Temos camisa polo P, M e G.',
      usage: { promptTokens: 10, totalTokens: 20 },
    });
    whatsapp.sendText.mockResolvedValue(undefined);
    messageModel.create.mockResolvedValue({ _id: outboundId, createdAt: now });
    realtimePublisher.publish.mockResolvedValue(undefined);
  });

  function createUsecase() {
    return new ProcessAiReplyUsecase(
      agentModel as never,
      organizationModel as never,
      contactModel as never,
      conversationModel as never,
      messageModel as never,
      knowledge as never,
      contextBuilder as never,
      llm as never,
      whatsapp as never,
      realtimePublisher as unknown as RealtimeEventsPublisherService,
    );
  }

  it('publica message-created outbound após persistir mensagem da IA', async () => {
    const usecase = createUsecase();

    await usecase.execute(inboundEvent);

    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: MessageDirection.OUTBOUND,
        metaMessageId: `local-out-${inboundEvent.eventId}`,
      }),
    );
    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 'realtime.event.v1',
        eventName: 'message-created',
        organizationId: inboundEvent.organizationId,
        agentId: inboundEvent.agentId,
        conversationId: conversationId.toString(),
        messageId: outboundId.toString(),
        direction: 'outbound',
      }),
    );
    expect(messageModel.create.mock.invocationCallOrder[0]).toBeLessThan(
      realtimePublisher.publish.mock.invocationCallOrder[0],
    );
  });

  it('não derruba o fluxo quando publish realtime falha', async () => {
    const usecase = createUsecase();
    realtimePublisher.publish.mockRejectedValue(new Error('rmq offline'));

    await expect(usecase.execute(inboundEvent)).resolves.toBeUndefined();
    expect(messageModel.create).toHaveBeenCalledTimes(1);
    expect(realtimePublisher.publish).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
  });

  it('não publica evento duplicado quando outbound já existe (idempotência)', async () => {
    const usecase = createUsecase();
    messageModel.create.mockRejectedValue({ code: 11000 });

    await expect(usecase.execute(inboundEvent)).resolves.toBeUndefined();
    expect(realtimePublisher.publish).not.toHaveBeenCalled();
  });
});
