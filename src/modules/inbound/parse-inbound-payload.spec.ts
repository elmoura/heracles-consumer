import { MESSAGE_INBOUND_SCHEMA_VERSION } from '@/shared/contracts/message-inbound.v1';
import { parseInboundPayload } from './parse-inbound-payload';

function minimalInbound() {
  return {
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
}

describe('parseInboundPayload', () => {
  it('aceita JSON cru do contrato', () => {
    const v = minimalInbound();
    expect(parseInboundPayload(v)).toEqual(v);
  });

  it('aceita envelope Nest { pattern, data }', () => {
    const v = minimalInbound();
    expect(
      parseInboundPayload({
        pattern: 'message.inbound.v1',
        data: v,
      }),
    ).toEqual(v);
  });

  it('aceita Buffer UTF-8 com JSON do contrato', () => {
    const v = minimalInbound();
    const buf = Buffer.from(JSON.stringify(v), 'utf8');
    expect(parseInboundPayload(buf)).toEqual(v);
  });

  it('aceita string JSON com contrato', () => {
    const v = minimalInbound();
    expect(parseInboundPayload(JSON.stringify(v))).toEqual(v);
  });

  it('aceita envelope com data em string JSON', () => {
    const v = minimalInbound();
    expect(
      parseInboundPayload({
        pattern: 'message.inbound.v1',
        data: JSON.stringify(v),
      }),
    ).toEqual(v);
  });

  it('aceita envelope com data em Buffer JSON', () => {
    const v = minimalInbound();
    expect(
      parseInboundPayload({
        pattern: 'message.inbound.v1',
        data: Buffer.from(JSON.stringify(v), 'utf8'),
      }),
    ).toEqual(v);
  });

  it('retorna null para payload invalido', () => {
    expect(parseInboundPayload({ foo: 1 })).toBeNull();
    expect(parseInboundPayload(null)).toBeNull();
  });
});
