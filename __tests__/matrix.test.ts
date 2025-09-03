import { describe, it, expect } from 'bun:test';
import { fixMatrix } from '../lib/latex-utils';

describe('matrix repair', () => {
    it('adds row breaks when rows are on separate lines', () => {
        const src = '\\begin{matrix}1 & 2\n3 & 4\\end{matrix}';
        const out = fixMatrix(src);
        expect(out).toContain('1 & 2 \\\\');
        expect(out).toContain('3 & 4');
    });

    it('does not triple escape existing \\', () => {
        const src = '\\begin{matrix}1 & 2\\\\ 3 & 4\\end{matrix}';
        const out = fixMatrix(src);
        // Should have exactly two backslashes before line break for first row
        expect(/1 & 2 \\\\ *\n/.test(out)).toBeTrue();
        // Should not contain sequence of 3 or more backslashes
        expect(/\\{3,}/.test(out)).toBeFalse();
    });
});
