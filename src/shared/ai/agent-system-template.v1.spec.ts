import {
  fillAgentSystemTemplateV1,
  AGENT_SYSTEM_TEMPLATE_V1,
} from './agent-system-template.v1';

describe('agent-system-template v1', () => {
  it('inclui secções obrigatórias', () => {
    expect(AGENT_SYSTEM_TEMPLATE_V1).toContain(
      '[INCERTEZA E INTERVENÇÃO HUMANA',
    );
    expect(AGENT_SYSTEM_TEMPLATE_V1).toContain('[REGRAS FINAIS]');
  });

  it('substitui placeholders', () => {
    const out = fillAgentSystemTemplateV1({
      businessContext: 'B',
      agentPrompt: 'A',
      csvSliceToon: 'C',
      sessionStateToon: 'S',
    });
    expect(out).toContain('B');
    expect(out).toContain('A');
    expect(out).toContain('C');
    expect(out).toContain('S');
  });
});
