import { valueToToon } from './toon';

describe('valueToToon', () => {
  it('serializa objeto simples', () => {
    const s = valueToToon({ a: 1, b: 'x' });
    expect(s).toContain('a');
    expect(s).toContain('1');
    expect(s).toContain('b');
    expect(s).toContain('x');
  });

  it('serializa array de objetos tabular quando homogéneo', () => {
    const s = valueToToon([
      { sku: 'A', price: 10 },
      { sku: 'B', price: 20 },
    ]);
    expect(s).toContain('sku');
    expect(s).toContain('price');
    expect(s).toContain('A');
    expect(s).toContain('10');
  });
});
