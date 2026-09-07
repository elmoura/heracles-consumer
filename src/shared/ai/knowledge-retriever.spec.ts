import { MistralEmbeddingsService } from './mistral-embeddings.service';
import { KnowledgeRetriever } from './knowledge-retriever';

const VECTOR_DIM = 1024;

describe('KnowledgeRetriever', () => {
  it('usa filtro obrigatório por organizationId e agentId e vetor Mistral', async () => {
    const mistral: Pick<MistralEmbeddingsService, 'embedQuery'> = {
      embedQuery: jest
        .fn()
        .mockResolvedValue(new Array<number>(VECTOR_DIM).fill(0.01)),
    };
    const retriever = new KnowledgeRetriever(
      mistral as MistralEmbeddingsService,
    );
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: [{ payload: { text: 'sku: A1 | name: Produto' } }],
        }),
    } as unknown as Response);

    const out = await retriever.retrieve({
      organizationId: 'org-1',
      agentId: 'agent-1',
      conversationId: 'conv-1',
      query: 'produto azul',
    });

    expect(out).toEqual(['sku: A1 | name: Produto']);
    expect(mistral.embedQuery).toHaveBeenCalledWith('produto azul');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    const init = calls[0]?.[1] ?? {};
    const rawBody = typeof init.body === 'string' ? init.body : '{}';
    const body = JSON.parse(rawBody) as {
      filter: { must: Array<{ key: string }> };
      vector: number[];
    };
    expect(body.filter.must).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'organizationId' }),
        expect.objectContaining({ key: 'agentId' }),
      ]),
    );
    expect(body.vector).toHaveLength(VECTOR_DIM);

    fetchMock.mockRestore();
  });
});
