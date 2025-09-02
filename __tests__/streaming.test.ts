import { describe, expect, it } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import fs from 'fs';
import path from 'path';
import { StreamMarkdown } from '..';

const complex = fs.readFileSync(path.join(__dirname, 'fixtures/complex.md'), 'utf8');

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
});
