import { Types } from 'mongoose';
import { ContextBuilder } from './context-builder';

describe('ContextBuilder', () => {
  const builder = new ContextBuilder();

  it('rejeita organizationId inválido', () => {
    expect(() =>
      builder.build({
        organizationId: 'invalid',
        agentId: new Types.ObjectId().toString(),
        conversationId: new Types.ObjectId(),
        agentPrompt: 'P',
        knowledgeSnippets: [],
        history: [],
        latestUserText: 'hi',
      }),
    ).toThrow();
  });

  it('monta system instruction com template comum e agente', () => {
    const out = builder.build({
      organizationId: new Types.ObjectId().toString(),
      agentId: new Types.ObjectId().toString(),
      conversationId: new Types.ObjectId(),
      agentPrompt: 'És um assistente útil.',
      knowledgeSnippets: [],
      history: [{ role: 'user', content: 'Olá' }],
      latestUserText: 'Quero ajuda',
      businessContextText: 'Tom: simpático',
      sessionStateToon: 'id\tabc',
    });
    expect(out.systemInstruction).toContain('[TEMPLATE PLATAFORMA');
    expect(out.systemInstruction).toContain('És um assistente útil.');
    expect(out.systemInstruction).toContain('Tom: simpático');
    expect(out.latestUser).toBe('Quero ajuda');
  });

  it('inclui snippets de knowledge quando existem', () => {
    const out = builder.build({
      organizationId: new Types.ObjectId().toString(),
      agentId: new Types.ObjectId().toString(),
      conversationId: new Types.ObjectId(),
      agentPrompt: 'P',
      knowledgeSnippets: ['Fact A'],
      history: [],
      latestUserText: 'x',
    });
    expect(out.systemInstruction).toContain('Fact A');
    expect(out.systemInstruction).toContain('[CONTEXTO ADICIONAL (retrieval)]');
  });
});
