/**
 * Serialização compacta tipo TOON para dados estruturados no prompt (M1-35).
 * Formato estável e legível; não é JSON verboso.
 */
export function valueToToon(value: unknown, depth = 0): string {
  const pad = '  '.repeat(depth);
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value.replace(/\r?\n/g, '\\n');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const isTabular =
      value.every(
        (x) => x !== null && typeof x === 'object' && !Array.isArray(x),
      ) && value.length > 0;
    if (isTabular) {
      const rows = value as Record<string, unknown>[];
      const keys = Object.keys(rows[0]).filter((k) =>
        rows.every((r) => Object.prototype.hasOwnProperty.call(r, k)),
      );
      if (keys.length === 0) {
        return value
          .map((v) => `${pad}- ${valueToToon(v, depth + 1)}`)
          .join('\n');
      }
      const header = keys.join('\t');
      const lines = rows.map((r) =>
        keys.map((k) => valueToToon(r[k], 0)).join('\t'),
      );
      return [header, ...lines].join('\n');
    }
    return value
      .map((v, i) => `${pad}${i}\t${valueToToon(v, depth + 1)}`)
      .join('\n');
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return keys
      .map((k) => `${pad}${k}\t${valueToToon(o[k], depth + 1)}`)
      .join('\n');
  }
  return '[unsupported]';
}
