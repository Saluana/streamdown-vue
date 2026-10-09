import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { fixMatrix } from '../lib/latex-utils';
import { StreamMarkdown } from '../src/StreamMarkdown';

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

    it('leaves matrix examples in code literal while prose matrices render', async () => {
        const inline = '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$';
        const fenced = '\\begin{matrix}1 & 2\n3 & 4\\end{matrix}';
        const html = await renderToString(
            h(StreamMarkdown, {
                content: [
                    `Inline: \`${inline}\``,
                    '',
                    '```latex',
                    fenced,
                    '```',
                    '',
                    '$$\\begin{matrix}5 & 6\\\\ 7 & 8\\end{matrix}$$',
                ].join('\n'),
            })
        );
        const escape = (text: string) => text.replace(/&/g, '&amp;');
        expect(html).toContain(
            `data-streamdown="inline-code">${escape(inline)}</code>`
        );
        expect(html).toContain(`>${escape(fenced)}\n</code></pre>`);
        expect((html.match(/katex-display/g) || []).length).toBe(1);
        expect(html).not.toContain('katex-error');
    });
});
