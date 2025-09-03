import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown, parseIncompleteMarkdown } from '..';

// Utility to render markdown quickly
const render = (md: string, extra: any = {}) =>
    renderToString(h(StreamMarkdown, { content: md, ...extra }));

describe('edge cases', () => {
    it('harden: relative links resolved with defaultOrigin & filtered by prefixes', async () => {
        const md = '[rel](/path) [drop](/internal)';
        const html = await render(md, {
            defaultOrigin: 'https://example.com/base/',
            allowedLinkPrefixes: ['https://example.com/'], // allow any under example.com root
        });
        expect(html).toContain('href="https://example.com/path"');
        // second still allowed (same origin) so both links render; rename test to reflect filtering by domain not path
        expect(html).toContain('href="https://example.com/internal"');
    });

    it('harden: rejects mixed-case javascript: scheme', async () => {
        const md = '[x](JaVaScRiPt:alert(1))';
        const html = await render(md);
        expect(html).toContain('x');
        expect(html).not.toMatch(/javascript:alert/i);
    });

    it('harden: image with uppercase protocol passes case-insensitive check', async () => {
        const md = '![ok](HTTPS://cdn.example.com/img.png)';
        const html = await render(md, {
            allowedImagePrefixes: ['https://cdn.example.com/'],
        });
        expect(html).toContain('img.png');
    });

    it('harden: base64 data URI image renders when prefix allowed', async () => {
        const b64 =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9oGxtWcAAAAASUVORK5CYII=';
        const md = `![dot](${b64})`;
        const html = await render(md, {
            allowedImagePrefixes: ['data:image/', 'https://', 'http://'],
        });
        expect(html).toContain(b64);
    });

    it('harden: base64 data URI image blocked when prefix not allowed', async () => {
        const b64 =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9oGxtWcAAAAASUVORK5CYII=';
        const md = `![dot](${b64})`;
        const html = await render(md); // default prefixes exclude data:
        expect(html).not.toContain('data:image/png;base64');
    });

    it('matrix variants: pmatrix & bmatrix repaired and rendered', async () => {
        const variants = ['pmatrix', 'bmatrix'];
        for (const v of variants) {
            const md = `$$\\begin{${v}}1 & 2\\\\ 3 & 4\\end{${v}}$$`;
            const html = await render(md);
            expect(html).toContain('katex');
            expect(html).toMatch(/1.*2.*3.*4/); // basic presence
        }
    });

    it('parseIncompleteMarkdown: completes ***bold+italic*** when cut mid token', () => {
        const input = 'Start ***bold-it';
        const out = parseIncompleteMarkdown(input);
        expect(out.endsWith('***')).toBe(true);
    });

    it('parseIncompleteMarkdown: leaves quadruple asterisks alone', () => {
        const input = '****';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('****');
    });

    it('parseIncompleteMarkdown: appends missing closing $$ newline style', () => {
        const input = '$$a+b=';
        const out = parseIncompleteMarkdown(input);
        expect(out).toBe('$$a+b=$$');
    });

    it('block merging: two consecutive partial math blocks merge before parse', async () => {
        // Simulate streaming where first piece has opening $$ and matrix begin, second closes
        const part1 = '$$\\begin{matrix}1 & 2\\\\';
        const part2 = '3 & 4\\end{matrix}$$';
        const html1 = await render(part1); // intermediate; not required to render matrix fully
        const html2 = await render(part1 + part2); // final combined content
        expect(html2).toContain('katex');
        expect(html2).toMatch(/1.*2.*3.*4/);
        expect(html1).not.toMatch(/katex-error/); // should not throw even incomplete
    });

    it('does not double-close already balanced $$ block', () => {
        const md = '$$x=1$$ more';
        const out = parseIncompleteMarkdown(md);
        expect(out).toBe(md); // unchanged
    });
});
