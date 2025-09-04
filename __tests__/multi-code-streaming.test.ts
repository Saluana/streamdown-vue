import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// Helper to count occurrences
const count = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

describe('multi large code block progressive streaming', () => {
    const code1Lines = Array.from(
        { length: 40 },
        (_, i) => `console.log('A${i}');`
    );
    const code2Lines = Array.from(
        { length: 35 },
        (_, i) => `process.stdout.write('B${i}');`
    );

    it('renders lines from both blocks progressively without duplication', async () => {
        let acc = '## Multi Code Streaming Test\n\n';

        // Start first block
        acc += '```js\n';
        for (let i = 0; i < 5; i++) acc += code1Lines[i] + '\n';
        let html = await renderToString(h(StreamMarkdown, { content: acc }));
        expect(html).toContain('data-streamdown="code-block"');
        expect(html).toContain('A0');
        expect(count(html, 'A0')).toBe(1);
        expect(html).not.toContain('B0');

        // Mid first block
        for (let i = 5; i < 20; i++) acc += code1Lines[i] + '\n';
        html = await renderToString(h(StreamMarkdown, { content: acc }));
        expect(html).toContain('A19');
        expect(count(html, 'A19')).toBe(1);

        // Finish first block
        for (let i = 20; i < code1Lines.length; i++)
            acc += code1Lines[i] + '\n';
        acc += '```\n\n';
        html = await renderToString(h(StreamMarkdown, { content: acc }));
        // Only one complete code block so far
        expect(count(html, 'data-streamdown="code-block"')).toBe(1);
        expect(html).toContain('A39');

        // Start second block (unclosed) with partial lines
        acc += '```ts\n';
        for (let i = 0; i < 10; i++) acc += code2Lines[i] + '\n';
        html = await renderToString(h(StreamMarkdown, { content: acc }));
        // Now two wrappers (first complete + second virtual closed)
        expect(
            count(html, 'data-streamdown="code-block"')
        ).toBeGreaterThanOrEqual(1);
        expect(html).toContain('B0');
        expect(count(html, 'B0')).toBe(1);

        // Mid second block
        for (let i = 10; i < 25; i++) acc += code2Lines[i] + '\n';
        html = await renderToString(h(StreamMarkdown, { content: acc }));
        expect(html).toContain('B24');
        expect(count(html, 'B24')).toBe(1);

        // Finish second block
        for (let i = 25; i < code2Lines.length; i++)
            acc += code2Lines[i] + '\n';
        acc += '```\n';
        html = await renderToString(h(StreamMarkdown, { content: acc }));
        expect(html).toContain('B34');
        expect(count(html, 'B34')).toBe(1);
        // Ensure no unexpected duplication of first block's early lines
        expect(count(html, 'A0')).toBe(1);
    });
});
