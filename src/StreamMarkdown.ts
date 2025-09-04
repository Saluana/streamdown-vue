import { defineComponent, h } from 'vue';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import type { Element, Root, Text } from 'hast';
import CodeBlock from './components/CodeBlock';
import MermaidBlock from './components/MermaidBlock';
import defaultComponents, { type ComponentMap } from './components/components';
import { parseBlocks } from '../lib/parse-blocks';
import { parseIncompleteMarkdown } from '../lib/parse-incomplete-markdown';
import { fixMatrix, normalizeDisplayMath } from '../lib/latex-utils';
import {
    hardenHref,
    hardenSrc,
    type HardenOptions,
} from './security/harden-vue-markdown';
// (Removed direct KaTeX CSS import to avoid bundling large base64 fonts.)
// Consumers must import 'katex/dist/katex.min.css' themselves (as documented in README).

export const StreamMarkdown = defineComponent({
    name: 'StreamMarkdown',
    props: {
        content: { type: String, default: '' },
        class: { type: String, default: '' },
        className: { type: String, default: '' },
        components: { type: Object as () => ComponentMap, default: () => ({}) },
        remarkPlugins: { type: Array as () => any[], default: () => [] },
        rehypePlugins: { type: Array as () => any[], default: () => [] },
        defaultOrigin: { type: String, default: undefined },
        allowedImagePrefixes: {
            type: Array as () => string[],
            default: () => ['https://', 'http://'],
        },
        allowedLinkPrefixes: {
            type: Array as () => string[],
            default: () => ['https://', 'http://'],
        },
        parseIncompleteMarkdown: { type: Boolean, default: true },
        shikiTheme: { type: String, default: 'github-light' },
    },
    setup(props, { slots }) {
        // Some bundlers (CJS builds) may wrap ESM-only remark/rehype plugins
        // so that the actual plugin function is under .default. If we pass the
        // namespace object to `unified().use()` it is treated as a (empty) preset
        // and unified throws "Expected usable value but received an empty preset".
        // This helper extracts the real function when necessary.
        const ensurePlugin = (p: any) =>
            p && typeof p === 'object' && 'default' in p
                ? (p as any).default
                : p;

        const processor = unified()
            .use(ensurePlugin(remarkParse))
            .use(ensurePlugin(remarkGfm))
            .use(ensurePlugin(remarkMath));

        props.remarkPlugins.forEach((p) => processor.use(ensurePlugin(p)));

        processor
            .use(ensurePlugin(remarkRehype), { allowDangerousHtml: false })
            .use(ensurePlugin(rehypeKatex));

        props.rehypePlugins.forEach((p) => processor.use(ensurePlugin(p)));

        const hardenOptions: HardenOptions = {
            allowedImagePrefixes: props.allowedImagePrefixes,
            allowedLinkPrefixes: props.allowedLinkPrefixes,
            defaultOrigin: props.defaultOrigin,
        };

        const componentsMap: ComponentMap = {
            ...defaultComponents,
            ...(props.components || {}),
        };

        const renderChildren = (nodes: any[], parent?: string): any[] =>
            nodes.map((n) => renderNode(n, parent)).filter(Boolean);

        function extractText(n: any): string {
            if (n.type === 'text') return n.value;
            if (n.children) return n.children.map(extractText).join('');
            return '';
        }

        // Helper to create a VNode with proper slot wrapping for component children
        const createVNode = (comp: any, props: any, children: any) => {
            const isHtml = typeof comp === 'string';
            if (isHtml) {
                return children && children.length
                    ? h(comp, props, children)
                    : h(comp, props);
            }
            if (
                !children ||
                (Array.isArray(children) && children.length === 0)
            ) {
                return h(comp, props);
            }
            const slotFn = Array.isArray(children)
                ? () => children
                : () => [children];
            return h(comp, props, { default: slotFn });
        };

        const renderNode = (node: any, parentTag?: string): any => {
            if (!node) return null;
            if (node.type === 'text') return (node as Text).value;
            if (node.type !== 'element') return null;
            const el = node as Element;
            const nodeProps: any = { ...(el.properties || {}) };
            const children = renderChildren(el.children || [], el.tagName);
            const tag = el.tagName;

            // security filters
            if (tag === 'a') {
                const href = hardenHref(
                    String(nodeProps.href || ''),
                    hardenOptions
                );
                if (!href) return children;
                nodeProps.href = href;
                nodeProps.target = '_blank';
                nodeProps.rel = 'noreferrer';
            }
            if (tag === 'img') {
                const src = hardenSrc(
                    String(nodeProps.src || ''),
                    hardenOptions
                );
                if (!src) return null;
                nodeProps.src = src;
            }

            // code or mermaid blocks
            if (
                tag === 'pre' &&
                el.children &&
                el.children[0] &&
                (el.children[0] as Element).tagName === 'code'
            ) {
                const codeEl = el.children[0] as Element;
                const code = extractText(codeEl);
                const className = (codeEl.properties?.className ||
                    []) as string[];
                const langClass = className.find((c) =>
                    c.startsWith('language-')
                );
                const lang = langClass
                    ? langClass.replace('language-', '')
                    : '';
                if (lang === 'mermaid') {
                    return h(MermaidBlock, { code });
                }
                return h(CodeBlock, {
                    code,
                    language: lang,
                    theme: props.shikiTheme,
                });
            }

            const comp = componentsMap[tag];
            if (comp) {
                return createVNode(comp, nodeProps, children);
            }
            return createVNode(tag, nodeProps, children);
        };

        return () => {
            let markdownSrc = props.content;
            const slotNodes = slots.default ? slots.default() : [];
            if (slotNodes && slotNodes.length > 0) {
                const text = slotNodes
                    .map((n: any) =>
                        typeof n.children === 'string' ? n.children : ''
                    )
                    .join('');
                if (text.trim()) markdownSrc = text;
            }

            // --- Progressive fenced code support ---
            // If streaming content currently ends with an unclosed fenced code block,
            // temporarily append a virtual closing fence so the partial code becomes visible.
            // Heuristic: count lines starting with optional spaces then ``` ; if odd, it's open.
            // We ONLY do this prior to block parsing; final content (when balanced) is unchanged.
            let virtualClosedFence = false;
            if (props.parseIncompleteMarkdown && markdownSrc) {
                const norm = markdownSrc.replace(/\r\n?/g, '\n');
                const lines = norm.split('\n');
                let fenceCount = 0;
                for (const line of lines) {
                    if (/^\s*```/.test(line)) fenceCount++;
                }
                if (fenceCount % 2 === 1) {
                    // Ensure there is at least one newline after code content before closing fence
                    // so remark-parse treats preceding lines as fenced code, not inline text.
                    const needsNewline = !/\n$/.test(norm);
                    markdownSrc = norm + (needsNewline ? '\n```' : '```');
                    virtualClosedFence = true;
                }
            }

            // Light LaTeX preprocessing: only fix matrix row breaks.
            // We intentionally do NOT auto-escape stray $ anymore to avoid
            // breaking streaming scenarios where the closing delimiter arrives later.
            // (debug logging removed)
            let preprocessed = fixMatrix(markdownSrc);
            const afterFix = preprocessed;
            preprocessed = normalizeDisplayMath(preprocessed);
            // (debug logging removed)

            const markdown = props.parseIncompleteMarkdown
                ? parseIncompleteMarkdown(preprocessed)
                : preprocessed;

            // First split into coarse blocks.
            let rawBlocks = virtualClosedFence
                ? [markdown]
                : parseBlocks(markdown);

            // Merge consecutive blocks if, when concatenated, they resolve an odd $$ count
            // (i.e. an opening display math without its closing yet). This prevents splitting
            // a multi-line matrix display between separate unified parses which causes KaTeX
            // to treat the opening as plain text.
            const merged: string[] = [];
            let buffer: string[] = [];
            let bufferDollarCount = 0;
            const flush = () => {
                if (buffer.length) {
                    merged.push(buffer.join('\n\n'));
                    buffer = [];
                    bufferDollarCount = 0;
                }
            };
            for (const blk of rawBlocks) {
                const count = (blk.match(/\$\$/g) || []).length;
                if (buffer.length === 0) {
                    if (count % 2 === 1) {
                        // start unbalanced sequence
                        buffer.push(blk);
                        bufferDollarCount += count;
                        continue;
                    } else {
                        merged.push(blk);
                        continue;
                    }
                } else {
                    buffer.push(blk);
                    bufferDollarCount += count;
                    if (bufferDollarCount % 2 === 0) {
                        flush();
                    }
                }
            }
            flush();

            const blocks = merged
                .map((b) => b)
                .map((b) =>
                    props.parseIncompleteMarkdown
                        ? parseIncompleteMarkdown(b.trim())
                        : b
                );
            // (debug logging removed)
            let vnodes = blocks.flatMap((block) => {
                const tree = processor.runSync(processor.parse(block)) as Root;
                return renderChildren(tree.children as any[]);
            });

            // Fallback: if we used a virtual fence and no code body produced any text nodes,
            // attempt manual extraction so partial code is visible.
            if (virtualClosedFence) {
                const hasVisibleCode = vnodes.some(
                    (n: any) =>
                        n &&
                        n.props &&
                        n.props['data-streamdown'] === 'code-block' &&
                        /<span|<code|<pre/.test(
                            (n.children && n.children[0]?.props?.innerHTML) ||
                                ''
                        )
                );
                if (!hasVisibleCode) {
                    const match = markdownSrc.match(
                        /```([a-z0-9_-]+)?\n([\s\S]*?)```$/i
                    );
                    if (match) {
                        const lang = (match[1] || '').trim();
                        const code = match[2];
                        // Remove matched segment from start portion
                        const prefix = markdownSrc.slice(0, match.index);
                        const prefixTree = processor.runSync(
                            processor.parse(prefix)
                        ) as Root;
                        const prefixVNodes = renderChildren(
                            (prefixTree.children as any[]) || []
                        );
                        vnodes = [
                            ...prefixVNodes,
                            h(CodeBlock, {
                                code: code || '',
                                language: lang,
                                theme: props.shikiTheme,
                            }),
                        ];
                    }
                }
            }
            const rootClass = [
                'streamdown-vue space-y-4',
                props.class,
                props.className,
            ]
                .filter(Boolean)
                .join(' ');
            return h('div', { class: rootClass || undefined }, vnodes);
        };
    },
});

export default StreamMarkdown;
