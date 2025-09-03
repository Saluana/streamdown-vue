import { describe, it, expect } from 'bun:test';
import { parseIncompleteMarkdown } from '../lib/parse-incomplete-markdown';
import { fixMatrix } from '../lib/latex-utils';

// Simulate streaming arrival of a matrix math block
// Previously premature $$ closing caused parse errors.
describe('streaming matrix handling', () => {
    it('does not prematurely close $$ when matrix environment still open', () => {
        const chunks = [
            '$$\n',
            '\n\\begin{matrix}1 & 2 \\\n',
            '3 & 4',
            '\\end{matrix}\n',
            '$$', // final closer
        ];
        let acc = '';
        for (let i = 0; i < chunks.length - 1; i++) {
            acc += chunks[i];
            const repaired = parseIncompleteMarkdown(acc);
            const dollarPairCount = (repaired.match(/\$\$/g) || []).length;
            const beginCount = (repaired.match(/\\begin\{/g) || []).length;
            const endCount = (repaired.match(/\\end\{/g) || []).length;
            // While an environment is still open, we should not have an even (>0) number of $$ pairs (which would imply closure)
            if (beginCount > endCount) {
                expect(dollarPairCount % 2).toBe(1); // still open math scope
            }
        }
        acc += chunks[chunks.length - 1];
        const final = fixMatrix(parseIncompleteMarkdown(acc));
        // Final should contain two $$ pairs (open + close)
        expect((final.match(/\$\$/g) || []).length).toBe(2);
        // Matrix rows normalized
        expect(/1 & 2\s+\\\\\s+3 & 4/.test(final)).toBeTrue();
    });
});
