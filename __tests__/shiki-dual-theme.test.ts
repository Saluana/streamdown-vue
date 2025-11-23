import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../index';

// Utility to SSR render StreamMarkdown with given props
async function renderMD(
    content: string,
    extraProps: Record<string, any> = {}
) {
    const app = createSSRApp({
        setup() {
            return () => h(StreamMarkdown, { content, ...extraProps });
        },
    });
    return await renderToString(app);
}

describe('Dual Theme Support', () => {
    const codeSample = 'const x = 1;\nconsole.log(x)';
    const md = '```ts\n' + codeSample + '\n```';

    it('accepts single theme string (backward compatibility)', async () => {
        const html = await renderMD(md, { shikiTheme: 'github-light' });
        expect(html).toContain('data-streamdown="code-block"');
        // Should render code block successfully
        expect(html).toMatch(/<pre[^>]*data-streamdown="pre"/);
        expect(html).toMatch(/<code[^>]*data-streamdown="code"/);
    });

    it('accepts dual theme object', async () => {
        const html = await renderMD(md, {
            shikiTheme: { light: 'github-light', dark: 'github-dark' },
        });
        expect(html).toContain('data-streamdown="code-block"');
        // Should render code block successfully
        expect(html).toMatch(/<pre[^>]*data-streamdown="pre"/);
        expect(html).toMatch(/<code[^>]*data-streamdown="code"/);
    });

    it('renders correctly with default single theme', async () => {
        // No shikiTheme prop provided, should use default 'github-light'
        const html = await renderMD(md);
        expect(html).toContain('data-streamdown="code-block"');
        expect(html).toMatch(/<pre[^>]*data-streamdown="pre"/);
        expect(html).toMatch(/<code[^>]*data-streamdown="code"/);
    });

    it('dual theme object works with inline code', async () => {
        const inlineMd = 'Here is some `inline code` example.';
        const html = await renderMD(inlineMd, {
            shikiTheme: { light: 'github-light', dark: 'github-dark' },
        });
        expect(html).toContain('data-streamdown="inline-code"');
    });

    it('single theme string works with multiple code blocks', async () => {
        const multiCodeMd = '```js\nconst a = 1;\n```\n\n```python\nprint("hi")\n```';
        const html = await renderMD(multiCodeMd, {
            shikiTheme: 'github-dark',
        });
        // Should have two code blocks
        const matches = html.match(/data-streamdown="code-block"/g);
        expect(matches?.length).toBe(2);
    });

    it('dual theme object works with multiple code blocks', async () => {
        const multiCodeMd = '```js\nconst a = 1;\n```\n\n```python\nprint("hi")\n```';
        const html = await renderMD(multiCodeMd, {
            shikiTheme: { light: 'github-light', dark: 'github-dark' },
        });
        // Should have two code blocks
        const matches = html.match(/data-streamdown="code-block"/g);
        expect(matches?.length).toBe(2);
    });

    it('dual theme with line numbers enabled', async () => {
        const html = await renderMD(md, {
            shikiTheme: { light: 'github-light', dark: 'github-dark' },
            codeBlockShowLineNumbers: true,
        });
        expect(html).toContain('data-streamdown="code-line-number"');
        const count = html.match(/code-line-number/g)?.length || 0;
        expect(count).toBeGreaterThanOrEqual(2);
    });

    it('handles empty theme object gracefully', async () => {
        // Edge case: malformed theme object should fallback gracefully
        const html = await renderMD(md, { shikiTheme: {} as any });
        // Should still render something (fallback behavior)
        expect(html).toContain('data-streamdown="code-block"');
    });

    it('null theme value should use default', async () => {
        const html = await renderMD(md, { shikiTheme: null as any });
        expect(html).toContain('data-streamdown="code-block"');
        expect(html).toMatch(/<pre[^>]*data-streamdown="pre"/);
    });

    it('preserves other code block props with dual theme', async () => {
        const html = await renderMD(md, {
            shikiTheme: { light: 'github-light', dark: 'github-dark' },
            codeBlockHideCopy: true,
            codeBlockHideDownload: true,
            codeBlockSelectable: false,
        });
        expect(html).not.toContain('copy-button');
        expect(html).not.toContain('download-button');
        expect(html).toMatch(/<pre[^>]*select-none/);
    });
});
