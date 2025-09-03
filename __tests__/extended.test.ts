import { describe, it, expect } from 'bun:test';
import { h, defineComponent } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// Helper to strip whitespace for simpler contains checks if needed
const compact = (s: string) => s.replace(/\s+/g, ' ');

describe('StreamMarkdown extended scenarios', () => {
    it('harden: drops javascript: links & keeps allowed https', async () => {
        const md = '[ok](https://example.com) [bad](javascript:alert(1))';
        const html = await renderToString(h(StreamMarkdown, { content: md }));
        expect(html).toContain('href="https://example.com"');
        expect(html).not.toContain('javascript:alert');
        // bad link should degrade to text
        expect(html).toContain('bad');
    });

    it('harden: blocks disallowed image src', async () => {
        const md =
            '![ok](https://cdn.example.com/x.png) ![bad](http://internal.local/file)';
        const html = await renderToString(
            h(StreamMarkdown, {
                content: md,
                allowedImagePrefixes: ['https://cdn.example.com/'],
            })
        );
        expect(html).toContain('src="https://cdn.example.com/x.png"');
        expect(html).not.toContain('internal.local');
    });

    it('component overrides: custom paragraph class applied', async () => {
        const CustomP = defineComponent({
            setup(_, { slots }) {
                return () => h('p', { class: 'custom-p' }, slots.default?.());
            },
        });
        const html = await renderToString(
            h(StreamMarkdown, {
                content: 'Hello world',
                components: { p: CustomP },
            })
        );
        expect(html).toContain('class="custom-p"');
    });

    it('renders math + mermaid + code together', async () => {
        const md = [
            'Inline math $a^2+b^2=c^2$.',
            '',
            '```mermaid',
            'graph TD;A-->B;',
            '```',
            '',
            '```ts',
            'const x: number = 1;',
            '```',
            '',
            '$$\\int_0^1 x^2 \\, dx = 1/3$$',
        ].join('\n');
        const html = await renderToString(h(StreamMarkdown, { content: md }));
        expect(html).toContain('data-streamdown="mermaid"');
        expect(html).toContain('katex');
        // Code may be highlighted asynchronously; fallback to presence of code-block container
        expect(html).toContain('data-streamdown="code-block"');
    });

    it('data attributes present for key elements', async () => {
        const md = '> Quote\n\n`inline`\n\n```js\nconsole.log(1)\n```';
        const html = await renderToString(h(StreamMarkdown, { content: md }));
        expect(html).toContain('data-streamdown="blockquote"');
        expect(html).toContain('data-streamdown="inline-code"');
        expect(html).toContain('data-streamdown="code-block"');
    });

    it('stress: large repeated content renders under time budget', async () => {
        const chunk =
            '# Title\n\nSome **bold** text with $e^{i\\pi}+1=0$.\n\n```ts\nexport const n=1;\n```\n\n';
        const content = chunk.repeat(40); // sizeable
        const start = performance.now();
        const html = await renderToString(h(StreamMarkdown, { content }));
        const dur = performance.now() - start;
        expect(
            html.split('data-streamdown="code-block"').length
        ).toBeGreaterThan(1);
        // soft budget; adjust if flaky in CI
        expect(dur).toBeLessThan(2000);
    });

    it('repairs incomplete markdown mid-stream style', async () => {
        const parts = ['# Head', 'ing\n\nPar', 'a **bol', 'd** wor', 'd end'];
        let acc = '';
        let lastHTML = '';
        for (const p of parts) {
            acc += p;
            lastHTML = await renderToString(
                h(StreamMarkdown, { content: acc })
            );
        }
        // The strong tag will include data attribute; just assert word wrapped in strong tag
        expect(lastHTML).toMatch(/<strong[^>]*>bold<\/strong>/);
    });
});
