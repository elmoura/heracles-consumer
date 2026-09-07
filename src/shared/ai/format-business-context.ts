/** Formata subdocumento `businessContext` da coleção organizations para o bloco [NEGÓCIO]. */
export function formatBusinessContextLines(
  raw:
    | {
        tone?: string;
        policies?: string;
        hours?: string;
        workingDays?: string;
        limits?: string;
      }
    | null
    | undefined,
): string {
  if (!raw || typeof raw !== 'object') {
    return '';
  }
  const parts: string[] = [];
  if (raw.tone?.trim()) {
    parts.push(`Tom: ${raw.tone.trim()}`);
  }
  if (raw.policies?.trim()) {
    parts.push(`Políticas: ${raw.policies.trim()}`);
  }
  if (raw.hours?.trim()) {
    parts.push(`Horário: ${raw.hours.trim()}`);
  }
  if (raw.workingDays?.trim()) {
    parts.push(`Dias úteis: ${raw.workingDays.trim()}`);
  }
  if (raw.limits?.trim()) {
    parts.push(`Limites: ${raw.limits.trim()}`);
  }
  return parts.join('\n');
}
