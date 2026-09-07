import type { MessageInboundV1 } from '@/shared/contracts/message-inbound.v1';
import { isMessageInboundV1 } from '@/shared/contracts/message-inbound.v1';

/** Envelope opcional enviado pelo `ClientProxy` RMQ do Nest (`@nestjs/microservices`). */
type NestRmqEnvelope = {
  pattern?: string;
  data?: unknown;
};

function parseJsonIfEncoded(raw: unknown): unknown {
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Extrai `message.inbound.v1` do payload (corpo cru ou envelope Nest `{ pattern, data }`).
 */
export function parseInboundPayload(raw: unknown): MessageInboundV1 | null {
  const parsed = parseJsonIfEncoded(raw);
  if (parsed === null) {
    return null;
  }
  if (isMessageInboundV1(parsed)) {
    return parsed;
  }
  const env = parsed as NestRmqEnvelope;
  if (env.data !== undefined) {
    const parsedData = parseJsonIfEncoded(env.data);
    if (parsedData !== null && isMessageInboundV1(parsedData)) {
      return parsedData;
    }
  }
  return null;
}
