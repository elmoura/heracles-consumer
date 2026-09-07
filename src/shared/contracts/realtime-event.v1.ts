export type RealtimeEventNameV1 = 'conversation-created' | 'message-created';

export type MessageDirectionV1 = 'inbound' | 'outbound';

type RealtimeEventBaseV1 = {
  schemaVersion: 'realtime.event.v1';
  eventId: string;
  eventName: RealtimeEventNameV1;
  occurredAt: string;
  organizationId: string;
  agentId: string;
  conversationId: string;
};

export type ConversationCreatedEventV1 = RealtimeEventBaseV1 & {
  eventName: 'conversation-created';
};

export type MessageCreatedEventV1 = RealtimeEventBaseV1 & {
  eventName: 'message-created';
  messageId: string;
  direction: MessageDirectionV1;
};

export type RealtimeEventV1 =
  | ConversationCreatedEventV1
  | MessageCreatedEventV1;

export function buildRealtimeRoutingKey(event: RealtimeEventV1): string {
  return `tenant.${event.organizationId}.${event.eventName}`;
}
