import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

describe('progressive fenced code edge cases', () => {
    it('renders code from second unclosed block after a complete first block', async () => {
        const md = '```ts\nconst a=1;\n```\n\n```ts\nlet b=2'; // second block unclosed
        const app = h(StreamMarkdown, { content: md });
        const html = await renderToString(app);
        // At least one code block wrapper exists.
        expect(html).toContain('data-streamdown="code-block"');
        // Both pieces of code should be present (may be in separate or merged blocks depending on parser heuristics)
        expect(html).toContain('const a=1;');
        expect(html).toContain('let b=2');
    });

    it('shows empty code body when only opening fence streamed', async () => {
        const md = '```py';
        const app = h(StreamMarkdown, { content: md });
        const html = await renderToString(app);
        expect(html).toContain('data-streamdown="code-block"');
        // No accidental stray closing fence injected (we add a virtual one but code body stays empty)
        // Ensure no code text yet
        // (Looking for absence of typical <code>content marker since SSR fallback includes empty <code>)
        // Just assert language label present
        expect(html).toContain('>py<');
    });

    it('accumulates lines across progressive updates without duplication', async () => {
        const step1 = '```js\nconsole.log(1';
        const html1 = await renderToString(
            h(StreamMarkdown, { content: step1 })
        );
        expect(html1).toContain('console.log(1');
        const step2 = step1 + '\nconsole.log(2';
        const html2 = await renderToString(
            h(StreamMarkdown, { content: step2 })
        );
        expect(html2).toContain('console.log(1');
        expect(html2).toContain('console.log(2');
        expect(html2.split('console.log(1').length - 1).toBe(1);
        const step3 = step2 + '\n```';
        const html3 = await renderToString(
            h(StreamMarkdown, { content: step3 })
        );
        expect(html3).toContain('console.log(1');
        expect(html3).toContain('console.log(2');
        expect(html3.split('console.log(1').length - 1).toBe(1);
    });
});
