import { describe, expect, it } from 'bun:test';
import { fixDollarSignMath, fixMatrix } from '../lib/latex-utils';

describe('latex utilities', () => {
    it('optional helper does not alter valid inline math', () => {
        const input = 'Euler: $e^{i\\pi}+1=0$';
        expect(fixDollarSignMath(input)).toBe(input);
    });

    it('fixes missing matrix row breaks', () => {
        const input = '\\begin{matrix}1 & 2\n3 & 4\\end{matrix}';
        const output = fixMatrix(input);
        expect(output).toContain('1 & 2 \\\\');
        expect(output).toContain('3 & 4');
    });
});
