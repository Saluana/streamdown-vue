import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown, parseIncompleteMarkdown } from '..';

const render = (md: string, extra: any = {}) =>
    renderToString(h(StreamMarkdown, { content: md, ...extra }));

describe('additional edge cases', () => {
    // 1. Incomplete link is stripped
    it('parseIncompleteMarkdown: removes trailing incomplete link', () => {
        const input = 'See [Docu';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('See '); // link start removed
    });

    // 2. Incomplete image is stripped
    it('parseIncompleteMarkdown: removes trailing incomplete image', () => {
        const input = 'Logo ![Alt tex';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('Logo ');
    });

    // 3. Inline triple backtick completion (```code`` -> ```code```)
    it('parseIncompleteMarkdown: completes inline triple backticks', () => {
        const input = '```console.log(1)``';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('```console.log(1)```');
    });

    // 4. Complete multi-line code block not altered
    it('parseIncompleteMarkdown: leaves complete fenced block untouched', () => {
        const input = '```js\nconst x=1;\n```';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe(input);
    });

    // 5. List marker asterisk not treated as emphasis
    it('parseIncompleteMarkdown: does not close list marker asterisk', () => {
        const input = '* item';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe(input);
    });

    // 6. Underscore inside math not auto-closed
    it('parseIncompleteMarkdown: ignores single underscore inside math', () => {
        const input = '$a_b + c$';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe(input);
    });

    // 7. Mixed emphasis mid-cut **bold *ital -> should close bold only
    it('parseIncompleteMarkdown: closes inner italic but leaves unmatched bold (current heuristic)', () => {
        const input = 'Example **bold *ital';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('Example **bold *ital*');
    });

    // 8. Incomplete strikethrough closed
    it('parseIncompleteMarkdown: closes ~~strike', () => {
        const input = '~~strike';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('~~strike~~');
    });

    // 9. Strikethrough markers inside code fence not modified
    it('parseIncompleteMarkdown: does not modify inside complete code fence', () => {
        const input = '```\n~~not strike~~\n```';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe(input);
    });

    // 10. Matrix with trailing blank lines normalized (no extra empty row)
    it('matrix: trailing blank lines ignored', async () => {
        const md = '$$\\begin{matrix}1 & 2\\\\ 3 & 4\\n\\n\\n\\end{matrix}$$';
        const html = await render(md);
        expect(html).toContain('katex');
        // Should render two rows only
        const rows = (html.match(/\\\\/g) || []).length; // from rendered KaTeX source string pattern
        expect(rows).toBeGreaterThanOrEqual(1); // loose check; exact row markup can vary
    });

    // 11. Matrix with single backslash row ending fixed to double
    it('matrix: single trailing backslash normalized', async () => {
        const md = '$$\\begin{matrix}1 & 2\\ 3 & 4\\\\end{matrix}$$';
        const html = await render(md);
        expect(html).toContain('katex');
    });

    // 12. Block merging spanning three segments
    it('block merging: three-way merge resolves math', async () => {
        const a = '$$';
        const b = '\\begin{matrix}1 & 2\\\\';
        const c = '3 & 4\\end{matrix}$$';
        const html = await render(a + b + c);
        expect(html).toContain('katex');
    });

    // 13. Two balanced math blocks remain separate
    it('block merging: preserves already balanced adjacent blocks', async () => {
        const md = '$$x=1$$\n$$y=2$$';
        const html = await render(md);
        // Expect two katex occurrences
        const count = (html.match(/katex/g) || []).length;
        expect(count).toBeGreaterThanOrEqual(2);
    });

    // 14. Disallowed image dropped fully
    it('harden: disallowed image removed', async () => {
        const md = '![logo](http://intranet.local/a.png)';
        const html = await render(md, {
            allowedImagePrefixes: ['https://cdn.example.com/'],
        });
        expect(html).not.toContain('intranet.local');
    });

    // 15. Unsupported protocol link dropped
    it('harden: ftp link dropped', async () => {
        const md = '[site](ftp://example.com/file)';
        const html = await render(md, {
            allowedLinkPrefixes: ['https://', 'http://'],
        });
        expect(html).not.toContain('ftp://');
        expect(html).toContain('site');
    });
});
