const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'client_secret',
]);

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lower)) {
    return true;
  }
  if (lower.includes('password')) {
    return true;
  }
  if (lower.includes('token') && lower !== 'organizationid') {
    return true;
  }
  return false;
}

/** Cópia superficial com valores sensíveis substituídos (paridade com hermes-api HTTP log). */
export function shallowRedact(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => shallowRedact(item));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (shouldRedactKey(k)) {
        out[k] = '[redacted]';
      } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = shallowRedact(v) as Record<string, unknown>;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return input;
}

const DEFAULT_MAX_LEN = 4096;

export function truncateForLog(
  text: string,
  maxLen: number = DEFAULT_MAX_LEN,
): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen)}…[truncated ${text.length - maxLen} chars]`;
}

/** Serializa valor para log: redact + JSON truncado; Buffer e strings binárias resumidas. */
export function safeSerializePayload(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'string') {
    return truncateForLog(value);
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length} preview=${truncateForLog(value.toString('utf8'), 256)}]`;
  }
  if (typeof value === 'object') {
    try {
      const redacted = shallowRedact(value);
      return truncateForLog(JSON.stringify(redacted));
    } catch {
      return '[object: not serializable]';
    }
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return truncateForLog(String(value));
  }
  if (typeof value === 'symbol' || typeof value === 'function') {
    return truncateForLog(value.toString());
  }
  return '[unsupported]';
}
