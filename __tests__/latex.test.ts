import { describe, expect, it } from 'bun:test';
import { fixDollarSignMath, fixMatrix } from '../lib/latex-utils';

describe('latex utilities', () => {
  it('preserves inline math', () => {
    const input = 'Euler: $e^{i\\pi}+1=0$';
    const output = fixDollarSignMath(input);
    expect(output).toBe(input);
  });

  it('escapes currency-like dollar signs', () => {
    const input = 'Cost is $5';
    const output = fixDollarSignMath(input);
    expect(output).toBe('Cost is \\$5');
  });

  it('fixes missing matrix row breaks', () => {
    const input = '\\begin{matrix}1 & 2\n3 & 4\\end{matrix}';
    const output = fixMatrix(input);
    expect(output).toContain('1 & 2 \\\\');
    expect(output).toContain('3 & 4');
  });
});
