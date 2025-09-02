import { expect, test } from 'bun:test';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';
import type { Plugin } from 'unified';
import { defineComponent, h } from 'vue';

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

test('filters disallowed images', async () => {
  const app = createSSRApp(StreamMarkdown, { content: '![x](javascript:evil)' });
  const html = await renderToString(app);
  expect(html).not.toContain('<img');
});

test('enforces allowed image prefixes', async () => {
  const app = createSSRApp(StreamMarkdown, {
    content: '![x](http://example.com/a.png)',
    allowedImagePrefixes: ['https://'],
  });
  const html = await renderToString(app);
  expect(html).not.toContain('<img');
});

test('slot content takes precedence over prop', async () => {
  const app = createSSRApp({
    render() {
      return h(
        StreamMarkdown,
        { content: '# Prop' },
        { default: () => '# Slot' }
      );
    },
  });
  const html = await renderToString(app);
  expect(html).toContain('<h1');
  expect(html).not.toContain('Prop');
});

test('allows relative links with defaultOrigin', async () => {
  const app = createSSRApp(StreamMarkdown, {
    content: '[ok](/test)',
    defaultOrigin: 'https://example.com',
    allowedLinkPrefixes: ['https://'],
  });
  const html = await renderToString(app);
  expect(html).toContain('href="https://example.com/test"');
});

test('inline and block code have data attributes', async () => {
  const md = '`inline`\n\n```js\ncode\n```';
  const app = createSSRApp(StreamMarkdown, { content: md });
  const html = await renderToString(app);
  expect(html).toContain('data-streamdown="inline-code"');
  expect(html).toContain('data-streamdown="code-block"');
  expect(html).toContain('button'); // copy button
});

test('custom components override defaults', async () => {
  const P = defineComponent({
    setup(_, { slots }) {
      return () => h('p', { class: 'text-red-500' }, slots.default?.());
    },
  });
  const app = createSSRApp(StreamMarkdown, {
    content: 'hi',
    components: { p: P },
  });
  const html = await renderToString(app);
  expect(html).toContain('text-red-500');
});

test('remark and rehype plugins are applied', async () => {
  const remark: Plugin = () => (tree: any) => {
    tree.children.push({ type: 'paragraph', children: [{ type: 'text', value: 'tail' }] });
  };
  const rehype: Plugin = () => (tree: any) => {
    const first = tree.children[0];
    if (first && first.type === 'element') {
      first.properties = first.properties || {};
      first.properties['data-test'] = 'ok';
    }
  };
  const app = createSSRApp(StreamMarkdown, {
    content: '# head',
    remarkPlugins: [remark],
    rehypePlugins: [rehype],
  });
  const html = await renderToString(app);
  expect(html).toContain('data-test="ok"');
  expect(html).toContain('tail');
});
