import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';
import { getRehypeKatex, preloadMath, resetMathForTests } from '../src/math';

// KaTeX loads on demand. Failure modes covered here:
// - content without math loads KaTeX anyway (no bundle saving);
// - math before KaTeX renders as a code block (copy/download controls) or not at all;
// - math never re-renders once KaTeX arrives (stuck as TeX source);
// - blocks cached before KaTeX loaded keep their unrendered trees;
// - an instance created before KaTeX loaded ignores it after another instance loads it;
// - `preloadMath()` does not give first-pass rendered math (SSR regression).

const display = 'Before\n\n$$\nE = mc^2\n$$\n\nAfter';
const inline = 'Mass–energy \\(E = mc^2\\) inline.';

// --- Minimal host renderer (no DOM dependency), as in parse-cache.test.ts ---
interface HostNode {
    tag: string;
    props: Record<string, unknown>;
    children: HostNode[];
    text?: string;
    parent: HostNode | null;
}
const node = (tag: string, text?: string): HostNode => ({ tag, props: {}, children: [], text, parent: null });
const nodeOps: any = {
    insert(child: HostNode, parent: HostNode, anchor?: HostNode | null) {
        child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        if (index === -1) parent.children.push(child);
        else parent.children.splice(index, 0, child);
    },
    remove(child: HostNode) {
        const siblings = child.parent?.children;
        if (siblings) siblings.splice(siblings.indexOf(child), 1);
        child.parent = null;
    },
    patchProp(el: HostNode, key: string, _prev: unknown, next: unknown) { el.props[key] = next; },
    createElement: (tag: string) => node(tag),
    createText: (text: string) => node('#text', text),
    createComment: (text: string) => node('#comment', text),
    setText(n: HostNode, text: string) { n.text = text; },
    setElementText(n: HostNode, text: string) { n.children = [node('#text', text)]; },
    parentNode: (n: HostNode) => n.parent,
    nextSibling(n: HostNode) {
        const siblings = n.parent?.children ?? [];
        return siblings[siblings.indexOf(n) + 1] ?? null;
    },
    querySelector: () => null,
    setScopeId() {},
};
const renderer = (createRenderer as any)(nodeOps);
const serialize = (n: HostNode): string => {
    if (n.tag === '#text') return n.text ?? '';
    if (n.tag === '#comment') return '';
    const attrs = Object.entries(n.props)
        .filter(([key, value]) => !key.startsWith('on') && value != null && typeof value !== 'function')
        .map(([key, value]) => ` ${key}="${Array.isArray(value) ? value.join(' ') : String(value)}"`)
        .join('');
    return `<${n.tag}${attrs}>${n.children.map(serialize).join('')}</${n.tag}>`;
};

const mountMarkdown = (initial: string) => {
    const content = ref(initial);
    const app = renderer.createApp(defineComponent({
        setup: () => () => h(StreamMarkdown, { content: content.value }),
    }));
    const container = node('container');
    app.mount(container);
    return {
        html: () => serialize(container),
        async set(next: string) {
            content.value = next;
            await nextTick();
        },
        unmount: () => app.unmount(),
    };
};

// Lets the shared KaTeX load promise and the resulting re-render settle.
const settle = async () => {
    await preloadMath();
    await nextTick();
    await nextTick();
};

describe('on-demand KaTeX', () => {
    beforeEach(() => resetMathForTests());
    afterAll(() => preloadMath());

    it('does not load KaTeX for content without math', async () => {
        const html = await renderToString(
            h(StreamMarkdown, { content: '# Title\n\nSome **bold** text and $390K.' })
        );
        await Promise.resolve();
        expect(html).toContain('data-streamdown="strong">bold</strong>');
        expect(html).not.toContain('math-pending');
        expect(getRehypeKatex()).toBeNull();
    });

    it('shows TeX source, not a code block, until KaTeX loads', async () => {
        const html = await renderToString(h(StreamMarkdown, { content: `${display}\n\n${inline}` }));
        expect(html).not.toContain('katex');
        expect(html).toContain('data-streamdown="math-pending"');
        expect(html).toContain('E = mc^2');
        expect(html).not.toContain('data-streamdown="code-block"');
        // Seeing math started the load.
        await preloadMath();
        expect(getRehypeKatex()).not.toBeNull();
    });

    it('renders math on the first pass after preloadMath()', async () => {
        await preloadMath();
        const html = await renderToString(h(StreamMarkdown, { content: `${display}\n\n${inline}` }));
        expect(html).toContain('katex-display');
        expect(html).toContain('class="katex"');
        expect(html).not.toContain('math-pending');
    });

    it('re-renders mounted math once KaTeX arrives', async () => {
        const view = mountMarkdown(display);
        expect(view.html()).toContain('math-pending');
        await settle();
        expect(view.html()).toContain('katex-display');
        expect(view.html()).not.toContain('math-pending');
        expect(view.html()).toContain('After');
        view.unmount();
    });

    it('re-parses streamed blocks cached before KaTeX loaded', async () => {
        const view = mountMarkdown('$$\na^2 + b^2 = c^2\n$$\n\nNext');
        await view.set('$$\na^2 + b^2 = c^2\n$$\n\nNext paragraph keeps');
        expect(view.html()).toContain('math-pending');
        await settle();
        await view.set('$$\na^2 + b^2 = c^2\n$$\n\nNext paragraph keeps growing');
        expect(view.html()).toContain('katex-display');
        expect(view.html()).not.toContain('math-pending');
        view.unmount();
    });

    it('uses KaTeX loaded by another instance when math streams in later', async () => {
        const plain = mountMarkdown('No math yet');
        await preloadMath();
        await plain.set(`No math yet\n\n${display}`);
        expect(plain.html()).toContain('katex-display');
        expect(plain.html()).not.toContain('math-pending');
        plain.unmount();
    });
});
