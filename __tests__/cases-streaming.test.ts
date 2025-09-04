import { describe, it, expect } from 'bun:test';
import { parseIncompleteMarkdown } from '../lib/parse-incomplete-markdown';

// Reproduces a streaming display math block with a cases environment using & alignment.
// We ensure the auto-close logic does NOT append a closing $$ while the environment
// (or its rows) are still structurally incomplete, avoiding KaTeX parse errors.
describe('streaming cases environment handling', () => {
    it('defers $$ closure until environment balanced', () => {
        const chunks = [
            '$$\\n',
            '\\n',
            '\\begin{cases} [\\\n',
            '\\vec{h}_{\\text{new}}] + \\text{snake}_t & \\text{if food eaten} \\\\n',
            '[\\vec{h}_{\\text{new}}] + \\text{snake}_t[0:-1] & \\text{otherwise} \\n',
            '\\end{cases}',
            '$$',
        ];

        let acc = '';
        for (let i = 0; i < chunks.length - 1; i++) {
            acc += chunks[i];
            const repaired = parseIncompleteMarkdown(acc);
            const dollarPairs = (repaired.match(/\$\$/g) || []).length;
            const beginCount = (repaired.match(/\\begin\{/g) || []).length;
            const endCount = (repaired.match(/\\end\{/g) || []).length;
            // If env imbalance, we must have an odd number of $$ (math still open)
            if (beginCount !== endCount) {
                expect(dollarPairs % 2).toBe(1);
            }
        }
        acc += chunks[chunks.length - 1];
        const final = parseIncompleteMarkdown(acc);
        const finalDollarPairs = (final.match(/\$\$/g) || []).length;
        expect(finalDollarPairs % 2).toBe(0); // closed properly at end
        // Contains both rows with alignment ampersands preserved
        expect(final).toContain('& \\text{if food eaten}');
        expect(final).toContain('& \\text{otherwise}');
    });
});
