import 'dotenv/config';

export const config = {
  mongoUri: process.env.MONGO_URI ?? '',
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? '',
    inboundExchange:
      process.env.RABBITMQ_WHATSAPP_INBOUND_EXCHANGE ??
      'whatsapp.inbound.fanout',
    /** Uma fila: persistência inbound e IA no mesmo handler, em sequência. */
    inboundPipelineQueue:
      process.env.RABBITMQ_QUEUE_WHATSAPP_INBOUND_PERSIST ??
      'q.whatsapp.inbound.persist',
    realtimeExchange:
      process.env.RABBITMQ_REALTIME_EXCHANGE ?? 'realtime.events.topic',
  },
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY ?? '',
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    /** Mesmo modelo que no Hermes no import CSV (`mistral-embed` = 1024 dim). */
    embeddingModel:
      process.env.MISTRAL_EMBEDDING_MODEL?.trim() || 'mistral-embed',
  },
  context: {
    maxMessages: (() => {
      const n = Number(process.env.HERACLES_CONTEXT_MAX_MESSAGES);
      return Number.isFinite(n) && n > 0 ? n : 20;
    })(),
    /** Fallback do bloco NEGÓCIO se `businessContext` não existir na org (M1-35). */
    businessContextStub: (
      process.env.HERACLES_BUSINESS_CONTEXT_STUB ?? ''
    ).trim(),
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? 'http://127.0.0.1:6333',
    apiKey: process.env.QDRANT_API_KEY ?? '',
    vectorSize: (() => {
      const n = Number(process.env.QDRANT_VECTOR_SIZE);
      return Number.isFinite(n) && n > 0 ? n : 1024;
    })(),
    topK: (() => {
      const n = Number(process.env.QDRANT_TOP_K);
      return Number.isFinite(n) && n > 0 ? n : 5;
    })(),
    /** Opcional: mínimo de score (cosine) para incluir hit; ex. 0.35 */
    scoreThreshold: (() => {
      const raw = process.env.QDRANT_SCORE_THRESHOLD?.trim();
      if (!raw) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    })(),
  },
};
