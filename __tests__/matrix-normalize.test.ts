import { fixMatrix, normalizeDisplayMath } from '../lib/latex-utils';

describe('matrix display math normalization', () => {
    it('expands single-line $$ matrix $$ into multiline block', () => {
        const src = '$$\\begin{matrix}1 & 2\\\\ 3 & 4\\end{matrix}$$';
        const fixed = fixMatrix(src);
        const normalized = normalizeDisplayMath(fixed);
        expect(/\$\$\n[\s\S]*\n\$\$/.test(normalized)).toBe(true);
        // Should have each row on its own line and no trailing \\
        const bodyContent = normalized.replace(/^\$\$\n?|\n?\$\$$/g, '');
        const lines = bodyContent
            .split(/\n/)
            .map((l: string) => l.trim())
            .filter(Boolean);
        const dataRows = lines.filter((l) => /&/.test(l));
        expect(dataRows.length).toBe(2);
        const [r1, r2] = dataRows;
        expect(/\\\\\s*$/.test(r1)).toBe(true);
        expect(/\\\\\s*$/.test(r2)).toBe(false);
    });
});
