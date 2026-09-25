import { describe, it, expect } from 'bun:test';
import { h, defineComponent, provide } from 'vue';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import {
    StreamMarkdown,
    CODE_BLOCK_META_KEY,
    GLOBAL_CODE_BLOCK_ACTIONS,
} from '../index';

// Utility to SSR render StreamMarkdown with given props & optional slots
async function renderMD(
    content: string,
    extraProps: Record<string, any> = {},
    withProvide?: (app: any) => void
) {
    const app = createSSRApp({
        setup() {
            if (withProvide) withProvide(provide as any);
            return () => h(StreamMarkdown, { content, ...extraProps });
        },
    });
    return await renderToString(app);
}

describe('CodeBlock feature matrix', () => {
    const codeSample = 'const x = 1;\nconsole.log(x)';
    const md = '```ts\n' + codeSample + '\n```';

    it('renders download + copy buttons by default', async () => {
        const html = await renderMD(md);
        expect(html).toContain('data-streamdown="code-block"');
        // Copy button has sr-only label ; Download has title attr
        expect(html).toMatch(/copy-button/);
        expect(html).toMatch(/download-button/);
        expect(html).toMatch(/<pre[^>]*data-streamdown="pre"/);
        expect(html).toMatch(/<code[^>]*data-streamdown="code"/);
    });

    it('hides copy & download when props set', async () => {
        const html = await renderMD(md, {
            codeBlockHideCopy: true,
            codeBlockHideDownload: true,
        });
        expect(html).not.toContain('copy-button');
        expect(html).not.toContain('download-button');
    });

    it('adds line numbers when enabled (SSR fallback)', async () => {
        const html = await renderMD(md, { codeBlockShowLineNumbers: true });
        const count = html.match(/code-line-number/g)?.length || 0;
        expect(count).toBeGreaterThanOrEqual(2);
        expect(html).toContain('data-streamdown="code-line-number"');
        expect(html).toMatch(/<pre[^>]*data-streamdown="pre"/);
        expect(html).toMatch(/<code[^>]*data-streamdown="code"/);
    });

    it('escapes raw HTML in the plaintext fallback', async () => {
        const dangerous =
            '<img src=x onerror="alert(1)"> & <script>alert(1)</script>';
        const html = await renderMD(
            '```unknown-language\n' + dangerous + '\n```'
        );

        expect(html).toContain(
            '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
        );
        expect(html).toContain(
            '&amp; &lt;script&gt;alert(1)&lt;/script&gt;'
        );
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('respects selectable=false (adds select-none to pre)', async () => {
        const html = await renderMD(md, { codeBlockSelectable: false });
        expect(html).toMatch(/<pre[^>]*select-none/);
    });

    it('injects custom per-instance actions', async () => {
        const Action = defineComponent({
            name: 'XAct',
            setup: () => () =>
                h(
                    'button',
                    { class: 'x-action', 'data-test-action': 'yes' },
                    'A'
                ),
        });
        const html = await renderMD(md, { codeBlockActions: [Action] });
        expect(html).toContain('x-action');
    });

    it('supports global injected actions', async () => {
        const Global = defineComponent({
            name: 'GlobalAct',
            setup: () => () => h('button', { class: 'g-action' }, 'G'),
        });
        const html = await renderMD(md, {}, (p: any) =>
            p(GLOBAL_CODE_BLOCK_ACTIONS, [Global])
        );
        expect(html).toContain('g-action');
    });

    it('allows overriding codeblock component via components map', async () => {
        const Minimal = defineComponent({
            props: { code: String, language: String },
            setup(props: any) {
                return () =>
                    h(
                        'pre',
                        {
                            class: 'minimal-pre',
                            'data-test-minimal': props.language,
                        },
                        props.code
                    );
            },
        });
        const html = await renderMD(md, { components: { codeblock: Minimal } });
        expect(html).toContain('minimal-pre');
        // built-in copy button should be absent because we replaced component
        expect(html).not.toContain('copy-button');
    });

    it('line numbers + non-selectable + hidden built-ins combination', async () => {
        const html = await renderMD(md, {
            codeBlockShowLineNumbers: true,
            codeBlockSelectable: false,
            codeBlockHideCopy: true,
            codeBlockHideDownload: true,
        });
        const count = html.match(/code-line-number/g)?.length || 0;
        expect(count).toBeGreaterThanOrEqual(2);
        expect(html).toContain('data-streamdown="code-line-number"');
        expect(html).toMatch(/<pre[^>]*select-none/);
        expect(html).not.toContain('copy-button');
        expect(html).not.toContain('download-button');
    });

});
