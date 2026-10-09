import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// Simulates user scenario: many bracket math blocks first, later an open progressive fenced code block starts.
// We stream chunk by chunk ensuring earlier math does not "fall back" to plain text when the open fence appears.

const introMath =
    `Intro text before math.\n\n` +
    Array.from(
        { length: 5 },
        (_, i) => `Line ${i + 1}\n\\[ a_${i} = b_${i} + c_${i} \\]\n`
    ).join('\n');

const midContent = `Some narrative paragraphs here to push content size.\n\nMore lines...\n\n`;

const openFenceStart =
    '```ts\n// progressive code start\nexport const value = 1;';

// Build streaming sequence: we cut the combined text into small slices (like the demo) up to just after opening fence.
const fullSoFar = introMath + midContent + openFenceStart;
const chunks = fullSoFar.match(/.{1,120}/gs) || []; // smallish chunks

describe('bracket math survives after progressive code fence opens', () => {
    it('keeps previously rendered bracket math as KaTeX', async () => {
        let acc = '';
        let lastHtml = '';
        const katexCounts: number[] = [];
        for (let i = 0; i < chunks.length; i++) {
            acc += chunks[i];
            const app = h(StreamMarkdown, { content: acc });
            lastHtml = await renderToString(app);
            const count = (lastHtml.match(/katex-display/g) || []).length;
            katexCounts.push(count);
        }
        // After final chunk the number of display math blocks should equal the number we introduced (5)
        const finalCount = katexCounts[katexCounts.length - 1];
        expect(finalCount).toBeGreaterThanOrEqual(5);
        // Verify monotonic non-decreasing (they should not disappear then reappear)
        for (let i = 1; i < katexCounts.length; i++) {
            const prev = katexCounts[i - 1]!; // non-null assertion (array index always valid here)
            expect(katexCounts[i]).toBeGreaterThanOrEqual(prev);
        }
        // Sanity: code block is present as progressive open fence (no closing fence yet)
        expect(lastHtml).toContain('data-streamdown="code-block"');
    });

    it('keeps prefix code literal at every prefix while a fence is open', async () => {
        const doc =
            'Use `\\[inline\\]` for brackets.\n\n\\[ m = 1 \\]\n\n```text\n\\[still code\\]\n';
        const fenceStart = doc.indexOf('```');
        for (let end = 1; end <= doc.length; end++) {
            const html = await renderToString(
                h(StreamMarkdown, { content: doc.slice(0, end) })
            );
            expect(html).not.toMatch(
                /(<annotation[^>]*>|class="katex-error"[^>]*>)[^<]*(inline|still)/
            );
            if (end >= doc.indexOf('`', 5) + 1) {
                expect(html).toContain('>\\[inline\\]</code>');
            }
            if (end > fenceStart + 3) {
                expect(html).toContain('data-open-fence="true"');
                expect((html.match(/katex-display/g) || []).length).toBe(1);
            }
        }
        const html = await renderToString(h(StreamMarkdown, { content: doc }));
        expect(html).toContain('>\\[still code\\]\n</code></pre>');
    }, 30000);
});
