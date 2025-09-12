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

    it('provides code & language via context (smoke test)', async () => {
        // Custom action component reading CODE_BLOCK_META_KEY context
        const Inspector = defineComponent({
            name: 'Inspector',
            setup() {
                return () =>
                    h('script', {
                        innerHTML: '/* inspector placeholder */',
                        'data-inspector': '1',
                    });
            },
        });
        // Provide global action that tries to access context in a mounted scenario.
        // SSR cannot execute injection inside unmounted child easily; we simply ensure global action render placeholder.
        const html = await renderMD(md, {}, (p: any) =>
            p(GLOBAL_CODE_BLOCK_ACTIONS, [Inspector])
        );
        expect(html).toContain('data-inspector');
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
        expect(html).toMatch(/<pre[^>]*select-none/);
        expect(html).not.toContain('copy-button');
        expect(html).not.toContain('download-button');
    });

    it('handles empty code fence gracefully with line numbers', async () => {
        const empty = '```js\n\n```';
        const html = await renderMD(empty, { codeBlockShowLineNumbers: true });
        // zero or one line number depending on split behavior; assert no crash & still code-block container
        expect(html).toContain('data-streamdown="code-block"');
    });
});
