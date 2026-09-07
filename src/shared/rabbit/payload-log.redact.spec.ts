import {
  safeSerializePayload,
  shallowRedact,
  truncateForLog,
} from './payload-log.redact';

describe('payload-log.redact', () => {
  it('shallowRedact mascara chaves sensiveis', () => {
    const out = shallowRedact({
      user: 'a',
      accessToken: 'secret',
      nested: { password: 'x' },
    }) as Record<string, unknown>;
    expect(out.user).toBe('a');
    expect(out.accessToken).toBe('[redacted]');
    expect((out.nested as Record<string, unknown>).password).toBe('[redacted]');
  });

  it('truncateForLog limita tamanho', () => {
    const long = 'x'.repeat(100);
    expect(truncateForLog(long, 20).length).toBeLessThan(long.length);
    expect(truncateForLog(long, 20)).toContain('truncated');
  });

  it('safeSerializePayload serializa objeto com redact', () => {
    const s = safeSerializePayload({ token: 't', ok: 1 });
    expect(s).toContain('[redacted]');
    expect(s).toContain('"ok":1');
  });

  it('safeSerializePayload resume Buffer', () => {
    const s = safeSerializePayload(Buffer.from('hello'));
    expect(s).toContain('Buffer');
    expect(s).toContain('hello');
  });
});
