import { Injectable, Logger } from '@nestjs/common';
import { config } from '@/config/config';
import { MistralEmbeddingsService } from './mistral-embeddings.service';

export type KnowledgeQuery = {
  organizationId: string;
  agentId: string;
  conversationId: string;
  query: string;
};

/**
 * Retrieve por similaridade vetorial no Qdrant (`catalog_items`), com embedding
 * Mistral (`mistral-embed`) alinhado ao import no Hermes.
 */
@Injectable()
export class KnowledgeRetriever {
  private readonly logger = new Logger(KnowledgeRetriever.name);

  constructor(private readonly mistralEmbeddings: MistralEmbeddingsService) {}

  async retrieve(query: KnowledgeQuery): Promise<string[]> {
    if (!config.qdrant.url || !query.query.trim()) {
      return [];
    }

    let vector: number[];
    try {
      vector = await this.mistralEmbeddings.embedQuery(query.query);
    } catch (e: unknown) {
      this.logger.warn(
        JSON.stringify({
          msg: 'knowledge_retriever_embedding_failed',
          error: String(e),
        }),
      );
      return [];
    }

    const body: Record<string, unknown> = {
      vector,
      limit: config.qdrant.topK,
      with_payload: true,
      filter: {
        must: [
          { key: 'organizationId', match: { value: query.organizationId } },
          { key: 'agentId', match: { value: query.agentId } },
        ],
      },
    };
    if (config.qdrant.scoreThreshold !== undefined) {
      body.score_threshold = config.qdrant.scoreThreshold;
    }

    const response = await fetch(
      `${config.qdrant.url.replace(/\/$/, '')}/collections/catalog_items/points/search`,
      {
        method: 'POST',
        headers: config.qdrant.apiKey
          ? {
              'Content-Type': 'application/json',
              'api-key': config.qdrant.apiKey,
            }
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'knowledge_retriever_qdrant_http_error',
          status: response.status,
        }),
      );
      return [];
    }

    const json = (await response.json()) as {
      result?: Array<{ payload?: Record<string, unknown> }>;
    };
    const result = json.result ?? [];
    const snippets: string[] = [];
    for (const hit of result) {
      const payload = hit.payload ?? {};
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      if (text) {
        snippets.push(text);
      }
    }
    return snippets;
  }
}
