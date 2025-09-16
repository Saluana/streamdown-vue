import { describe, expect, it } from 'bun:test';
import {
    fixDollarSignMath,
    fixMatrix,
    normalizeBracketDisplayMath,
} from '../lib/latex-utils';

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

    it('normalizes bracket math inside blockquotes into $$ blocks', () => {
        const input = ['> 引用', '> \\[ x^2 \\]', '> 结束'].join('\n');
        const output = normalizeBracketDisplayMath(input);
        expect(output).toContain('> $$');
        expect(output).toContain('> x^2');
        expect(output).toContain('> $$\n> 结束');
        expect(output).not.toContain('\\\\[');
    });

    it('skips normalization inside indented fences', () => {
        const input = ['> ```', '> \\[raw\\]', '> ```', '', '\\[ real \\]'].join('\n');
        const output = normalizeBracketDisplayMath(input);
        expect(output).toContain('> ```');
        expect(output).toContain('> \\[raw\\]');
        expect(output).toMatch(/\$\$\s*\nreal\s*\n\$\$/);
    });

    it('keeps trailing text after single-line closures in blockquotes', () => {
        const input = '> \\[ x^2 \\] 继续';
        const output = normalizeBracketDisplayMath(input);
        expect(output).toContain('> $$');
        expect(output).toContain('> x^2');
        expect(output).toContain('> $$\n> 继续');
    });
});
