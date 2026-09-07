import { mapMistralUsage, parseAgentReplyV1 } from './llm-client';

describe('parseAgentReplyV1', () => {
  it('parseia JSON válido', () => {
    const out = parseAgentReplyV1(
      JSON.stringify({
        requiresHumanIntervention: false,
        userMessage: 'Olá! Como posso ajudar?',
      }),
    );
    expect(out).toEqual({
      requiresHumanIntervention: false,
      userMessage: 'Olá! Como posso ajudar?',
    });
  });

  it('parseia JSON em code fence', () => {
    const out = parseAgentReplyV1(`\`\`\`json
{"requiresHumanIntervention":true,"userMessage":"Encaminhando para humano."}
\`\`\``);
    expect(out).toEqual({
      requiresHumanIntervention: true,
      userMessage: 'Encaminhando para humano.',
    });
  });

  it('retorna null para payload inválido', () => {
    expect(parseAgentReplyV1('texto livre')).toBeNull();
    expect(
      parseAgentReplyV1(
        JSON.stringify({
          requiresHumanIntervention: 'nope',
          userMessage: 123,
        }),
      ),
    ).toBeNull();
  });
});

describe('mapMistralUsage', () => {
  it('mapeia usage válido do Mistral', () => {
    expect(
      mapMistralUsage({
        prompt_tokens: 12,
        total_tokens: 50,
      }),
    ).toEqual({
      promptTokens: 12,
      totalTokens: 50,
    });
  });

  it('retorna undefined quando usage ausente/inválido', () => {
    expect(mapMistralUsage(undefined)).toBeUndefined();
    expect(
      mapMistralUsage({
        prompt_tokens: Number.NaN,
        total_tokens: Number.NaN,
      }),
    ).toBeUndefined();
  });
});
