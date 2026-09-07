import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { fillAgentSystemTemplateV1 } from './agent-system-template.v1';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type BuiltLlmContext = {
  systemInstruction: string;
  history: ChatTurn[];
  latestUser: string;
};

export type ContextBuilderParams = {
  businessName: string;
  organizationId: string;
  agentId: string;
  conversationId: Types.ObjectId;
  /** Instruções específicas do agente (bloco variável). */
  agentPrompt: string;
  knowledgeSnippets: string[];
  history: ChatTurn[];
  latestUserText: string;
  /** Texto do bloco [NEGÓCIO] (já formatado). */
  businessContextText?: string;
  /** Fatia de catálogo em TOON (stub até M1-37). */
  catalogSliceToon?: string;
  /** Estado de sessão em TOON. */
  sessionStateToon?: string;
};

@Injectable()
export class ContextBuilder {
  build(params: ContextBuilderParams): BuiltLlmContext {
    if (
      !Types.ObjectId.isValid(params.organizationId) ||
      !Types.ObjectId.isValid(params.agentId)
    ) {
      throw new Error('ContextBuilder: ids inválidos.');
    }
    if (!params.conversationId) {
      throw new Error('ContextBuilder: conversationId obrigatório.');
    }

    const businessContext = (params.businessContextText ?? '').trim();
    const csvSliceToon = (params.catalogSliceToon ?? '').trim() || '(vazio)';
    const sessionStateToon =
      (params.sessionStateToon ?? '').trim() || '(vazio)';

    let systemInstruction = fillAgentSystemTemplateV1({
      businessName: params.businessName,
      businessContext:
        businessContext.length > 0 ? businessContext : '(não definido)',
      agentPrompt: params.agentPrompt.trim() || '(sem instruções do agente)',
      csvSliceToon,
      sessionStateToon,
    });

    if (params.knowledgeSnippets.length > 0) {
      systemInstruction += `\n\n[CONTEXTO ADICIONAL (retrieval)]\n${params.knowledgeSnippets.join('\n---\n')}`;
    }

    systemInstruction += `\n\nRegras: responde apenas com base no histórico desta conversa e nas instruções acima. Não inventes dados de outras organizações ou conversas.`;

    return {
      systemInstruction,
      history: params.history,
      latestUser: params.latestUserText,
    };
  }
}
