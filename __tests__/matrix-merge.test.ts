import { parseBlocks } from '../lib/parse-blocks';
import { fixMatrix, normalizeDisplayMath } from '../lib/latex-utils';
import { describe, it, expect } from 'bun:test';

// Mirrors the merging logic introduced in StreamMarkdown to ensure unbalanced $$ blocks get merged.
function mergeBlocks(blocks: string[]): string[] {
    const merged: string[] = [];
    let buffer: string[] = [];
    let bufferDollarCount = 0;
    const flush = () => {
        if (buffer.length) {
            merged.push(buffer.join('\n\n'));
            buffer = [];
            bufferDollarCount = 0;
        }
    };
    for (const blk of blocks) {
        const cnt = (blk.match(/\$\$/g) || []).length;
        if (buffer.length === 0) {
            if (cnt % 2 === 1) {
                buffer.push(blk);
                bufferDollarCount += cnt;
                continue;
            }
            merged.push(blk);
            continue;
        } else {
            buffer.push(blk);
            bufferDollarCount += cnt;
            if (bufferDollarCount % 2 === 0) flush();
        }
    }
    flush();
    return merged;
}

describe('matrix block merging', () => {
    it('keeps multi-line matrix display math contiguous', () => {
        const content = [
            'Intro',
            '$$\\begin{matrix}',
            '1 & 2 \\ 3 & 4',
            '\\end{matrix}$$',
            'After',
        ].join('\n\n');
        const fixed = normalizeDisplayMath(fixMatrix(content));
        const blocks = parseBlocks(fixed);
        const merged = mergeBlocks(blocks);
        const matrixBlock = merged.find((b) => /\\begin{matrix}/.test(b));
        expect(matrixBlock).toBeTruthy();
        // The block should contain both opening and closing plus two rows.
        expect(/\\begin{matrix}[\s\S]*\\end{matrix}/.test(matrixBlock!)).toBe(
            true
        );
        expect(/1\s*&\s*2/.test(matrixBlock!)).toBe(true);
        expect(/3\s*&\s*4/.test(matrixBlock!)).toBe(true);
    });
});
