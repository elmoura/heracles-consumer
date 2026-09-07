export function normalizeWaId(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
