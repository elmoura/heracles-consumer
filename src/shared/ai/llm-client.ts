import { Injectable, Logger } from '@nestjs/common';
import { config } from '@/config/config';
import type { BuiltLlmContext } from './context-builder';

type MistralChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type MistralChatCompleteResult = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

export type AgentReplyUsageV1 = {
  promptTokens?: number;
  totalTokens?: number;
};

export type AgentReplyV1 = {
  requiresHumanIntervention: boolean;
  userMessage: string;
  usage?: AgentReplyUsageV1;
};

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function parseAgentReplyV1(raw: string): AgentReplyV1 | null {
  const text = stripCodeFence(raw);
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (
      typeof parsed.requiresHumanIntervention !== 'boolean' ||
      typeof parsed.userMessage !== 'string'
    ) {
      return null;
    }
    return {
      requiresHumanIntervention: parsed.requiresHumanIntervention,
      userMessage: parsed.userMessage.trim(),
    };
  } catch {
    return null;
  }
}

export function mapMistralUsage(
  usage: MistralChatCompleteResult['usage'] | undefined,
): AgentReplyUsageV1 | undefined {
  if (!usage) {
    return undefined;
  }
  const promptTokens =
    typeof usage.prompt_tokens === 'number' &&
    Number.isFinite(usage.prompt_tokens)
      ? usage.prompt_tokens
      : undefined;
  const totalTokens =
    typeof usage.total_tokens === 'number' &&
    Number.isFinite(usage.total_tokens)
      ? usage.total_tokens
      : undefined;
  if (promptTokens === undefined && totalTokens === undefined) {
    return undefined;
  }
  return { promptTokens, totalTokens };
}

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  async generateReply(ctx: BuiltLlmContext): Promise<AgentReplyV1> {
    const key = config.mistral.apiKey?.trim();
    if (!key) {
      this.logger.warn(
        'MISTRAL_API_KEY ausente — fallback estruturado com intervenção humana.',
      );
      return {
        requiresHumanIntervention: true,
        userMessage:
          'No momento não consegui processar sua mensagem automaticamente. Um humano seguirá com o atendimento.',
      };
    }

    const { Mistral } = await import('@mistralai/mistralai');
    const mistral = new Mistral({ apiKey: key });

    const messages: MistralChatMessage[] = [
      { role: 'system', content: ctx.systemInstruction },
      ...ctx.history.map((h) => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: ctx.latestUser },
    ];

    const result = (await mistral.chat.complete({
      model: config.mistral.model,
      messages,
    })) as MistralChatCompleteResult;

    const text = result.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? parseAgentReplyV1(text) : null;
    if (!parsed) {
      this.logger.error(
        JSON.stringify({
          msg: 'llm_reply_parse_failed',
          hasContent: typeof text === 'string' && text.trim().length > 0,
        }),
      );
      return {
        requiresHumanIntervention: true,
        userMessage:
          'Preciso de ajuda humana para responder com segurança a esta solicitação.',
      };
    }
    return {
      ...parsed,
      usage: mapMistralUsage(result.usage),
    };
  }
}
