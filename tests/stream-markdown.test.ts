import { expect, test } from 'bun:test';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

test('renders basic markdown', async () => {
  const app = createSSRApp(StreamMarkdown, { content: '# Hello' });
  const html = await renderToString(app);
  expect(html).toContain('<h1');
});

test('filters disallowed links', async () => {
  const app = createSSRApp(StreamMarkdown, { content: '[x](javascript:alert(1))' });
  const html = await renderToString(app);
  expect(html).not.toContain('<a');
});
