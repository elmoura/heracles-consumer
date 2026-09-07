/** Alinhado a hermes-api/src/shared/contracts/message-inbound.v1.ts */
export const MESSAGE_INBOUND_SCHEMA_VERSION = 'message.inbound.v1' as const;

export type MessageInboundV1 = {
  schemaVersion: typeof MESSAGE_INBOUND_SCHEMA_VERSION;
  eventId: string;
  organizationId: string;
  agentId: string;
  metaPhoneNumberId: string;
  metaMessageId: string;
  fromWaId: string;
  contactName?: string;
  timestampIso: string;
  messageType: string;
  text?: string;
  rawMessage: Record<string, unknown>;
};

export function isMessageInboundV1(v: unknown): v is MessageInboundV1 {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const o = v as MessageInboundV1;
  return (
    o.schemaVersion === MESSAGE_INBOUND_SCHEMA_VERSION &&
    typeof o.eventId === 'string' &&
    typeof o.organizationId === 'string' &&
    typeof o.agentId === 'string' &&
    typeof o.metaPhoneNumberId === 'string' &&
    typeof o.metaMessageId === 'string' &&
    typeof o.fromWaId === 'string'
  );
}
