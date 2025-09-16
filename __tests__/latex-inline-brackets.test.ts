import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// Ensures inline bracket math within a paragraph is lifted to a display block.

describe('inline bracket math normalization', () => {
    it('converts inline \\[ a + b = c \\] into display KaTeX', async () => {
        const md = 'Intro text then \\[ a + b = c \\] continues same line.';
        const html = await renderToString(h(StreamMarkdown, { content: md }));
        const displayCount = (html.match(/katex-display/g) || []).length;
        expect(displayCount).toBeGreaterThanOrEqual(1);
        expect(html).toContain('a + b = c');
    });
});
