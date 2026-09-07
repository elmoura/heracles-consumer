import { Injectable, Logger } from '@nestjs/common';
import { config } from '@/config/config';

type MistralEmbeddingsResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
};

@Injectable()
export class MistralEmbeddingsService {
  private readonly logger = new Logger(MistralEmbeddingsService.name);

  /** Um único texto → um vetor (dimensão = `config.qdrant.vectorSize`, ex. 1024). */
  async embedQuery(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('embedQuery: texto vazio');
    }
    const apiKey = config.mistral.apiKey?.trim();
    if (!apiKey) {
      throw new Error(
        'MISTRAL_API_KEY é obrigatório para retrieve semântico no Qdrant.',
      );
    }
    const vectors = await this.embedBatch([trimmed], apiKey);
    const vec = vectors[0];
    if (vec.length !== config.qdrant.vectorSize) {
      throw new Error(
        `Embedding dimensão ${vec.length} ≠ QDRANT_VECTOR_SIZE=${config.qdrant.vectorSize}.`,
      );
    }
    return vec;
  }

  private async embedBatch(
    texts: string[],
    apiKey: string,
  ): Promise<number[][]> {
    const model = config.mistral.embeddingModel;
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: texts }),
    });

    const raw = await response.text();
    let body: MistralEmbeddingsResponse;
    try {
      body = JSON.parse(raw) as MistralEmbeddingsResponse;
    } catch {
      this.logger.warn(
        JSON.stringify({
          msg: 'mistral_embeddings_parse_error',
          status: response.status,
          raw: raw.slice(0, 500),
        }),
      );
      throw new Error(
        `Mistral embeddings HTTP ${response.status}: resposta não JSON.`,
      );
    }

    if (!response.ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'mistral_embeddings_failed',
          status: response.status,
          body,
        }),
      );
      throw new Error(
        `Mistral embeddings falhou (${response.status}). Ver logs para detalhes.`,
      );
    }

    const data = body.data ?? [];
    const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors: number[][] = [];
    for (const item of sorted) {
      const emb = item.embedding;
      if (!emb || emb.length === 0) {
        throw new Error('Mistral embeddings: vetor vazio na resposta.');
      }
      vectors.push(emb);
    }
    if (vectors.length !== texts.length) {
      throw new Error(
        `Mistral embeddings: batch size ${texts.length} ≠ ${vectors.length}.`,
      );
    }
    return vectors;
  }
}
