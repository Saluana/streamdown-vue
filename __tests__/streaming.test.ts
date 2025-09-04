import { describe, expect, it } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import fs from 'fs';
import path from 'path';
// Import directly from source to ensure latest code is used in tests without requiring a build step
import { StreamMarkdown } from '../src/StreamMarkdown';

const complex = fs.readFileSync(
    path.join(__dirname, 'fixtures/complex.md'),
    'utf8'
);

describe('streaming render', () => {
    it('streams complex markdown and renders expected HTML', async () => {
        const chunks = complex.match(/.{1,500}/gs) || [];
        let acc = '';
        let html = '';
        const warn = console.warn;
        const err = console.error;
        console.warn = () => {};
        console.error = () => {};
        for (const chunk of chunks) {
            acc += chunk;
            const app = h(StreamMarkdown, { content: acc });
            html = await renderToString(app);
        }
        console.warn = warn;
        console.error = err;
        expect(html).toContain('<table');
        expect(html).toContain('data-streamdown="mermaid"');
        expect(html).toContain('katex');
    });

    it('renders within performance budget', async () => {
        const warn = console.warn;
        const err = console.error;
        console.warn = () => {};
        console.error = () => {};
        const start = performance.now();
        const app = h(StreamMarkdown, { content: complex });
        await renderToString(app);
        const duration = performance.now() - start;
        console.warn = warn;
        console.error = err;
        console.log('render time ms:', duration.toFixed(2));
        expect(duration).toBeLessThan(1000);
    });
    it('progressive unclosed fenced code becomes visible', async () => {
        const step1 = '```js\nconsole.log(1';
        const app1 = h(StreamMarkdown, { content: step1 });
        const html1 = await renderToString(app1);
        expect(html1).toContain('data-streamdown="code-block"');
        expect(html1).toContain('console.log(1');
        const step2 = step1 + '\n```';
        const app2 = h(StreamMarkdown, { content: step2 });
        const html2 = await renderToString(app2);
        expect(html2).toContain('console.log(1');
        const occurrences = html2.split('console.log(1').length - 1;
        expect(occurrences).toBe(1);
    });
});
