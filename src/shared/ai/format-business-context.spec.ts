import { formatBusinessContextLines } from './format-business-context';

describe('formatBusinessContextLines', () => {
  it('retorna vazio sem dados', () => {
    expect(formatBusinessContextLines(undefined)).toBe('');
    expect(formatBusinessContextLines({})).toBe('');
  });

  it('concatena campos preenchidos', () => {
    expect(
      formatBusinessContextLines({
        tone: ' formal ',
        workingDays: 'Seg–Sex',
      }),
    ).toContain('Tom: formal');
    expect(
      formatBusinessContextLines({
        tone: ' formal ',
        workingDays: 'Seg–Sex',
      }),
    ).toContain('Dias úteis: Seg–Sex');
  });
});
