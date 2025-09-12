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
        // --- CodeBlock pass-through customization ---
        codeBlockActions: { type: Array as () => any[], default: () => [] },
        codeBlockShowLineNumbers: { type: Boolean, default: false },
        codeBlockSelectable: { type: Boolean, default: true },
        codeBlockHideCopy: { type: Boolean, default: false },
        codeBlockHideDownload: { type: Boolean, default: false },
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

        // Detect if user provides their own remark-math (plain or tuple form)
        const userSuppliesRemarkMath = props.remarkPlugins.some(
            (entry: any) => {
                const plugin = Array.isArray(entry) ? entry[0] : entry;
                const resolved = ensurePlugin(plugin);
                return resolved === remarkMath;
            }
        );

        const processor = unified()
            .use(ensurePlugin(remarkParse))
            .use(ensurePlugin(remarkGfm));

        // Default: include remark-math but disable single-dollar inline math so currency like $390K is safe.
        if (!userSuppliesRemarkMath) {
            processor.use(ensurePlugin(remarkMath), {
                singleDollarTextMath: false,
            });
        }

        // Support [plugin, options] tuples for remark plugins
        props.remarkPlugins.forEach((entry: any) => {
            if (Array.isArray(entry)) {
                const [plugin, options] = entry;
                processor.use(ensurePlugin(plugin), options);
            } else {
                processor.use(ensurePlugin(entry));
            }
        });

        processor
            .use(ensurePlugin(remarkRehype), { allowDangerousHtml: false })
            .use(ensurePlugin(rehypeKatex));

        // Support [plugin, options] tuples for rehype plugins (deduped loop)
        props.rehypePlugins.forEach((entry: any) => {
            if (Array.isArray(entry)) {
                const [plugin, options] = entry;
                processor.use(ensurePlugin(plugin), options);
            } else {
                processor.use(ensurePlugin(entry));
            }
        });

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
                const CodeComp =
                    (componentsMap['codeblock'] as any) || CodeBlock;
                return h(CodeComp, {
                    code,
                    language: lang,
                    theme: props.shikiTheme,
                    actions: props.codeBlockActions,
                    showLineNumbers: props.codeBlockShowLineNumbers,
                    selectable: props.codeBlockSelectable,
                    hideCopy: props.codeBlockHideCopy,
                    hideDownload: props.codeBlockHideDownload,
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

            // --- Progressive fenced code support (improved) ---
            // Instead of appending a synthetic closing fence (which caused full re-parse + flicker),
            // detect an OPEN fenced code block and render its partial contents directly as a CodeBlock
            // while still parsing all *preceding* markdown normally. This avoids mutating the original
            // markdown string and prevents reparsing the entire (synthetically closed) block each tick.
            let openFenceInfo: null | {
                prefix: string; // markdown before the open fence
                code: string; // partial code collected so far (without trailing ```)
                lang: string;
            } = null;
            if (
                props.parseIncompleteMarkdown &&
                typeof markdownSrc === 'string' &&
                markdownSrc.length
            ) {
                const norm = markdownSrc.replace(/\r\n?/g, '\n');
                const lines = norm.split('\n');
                let fenceIndices: number[] = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i] ?? '';
                    if (/^\s*```/.test(line)) fenceIndices.push(i);
                }
                if (fenceIndices.length > 0 && fenceIndices.length % 2 === 1) {
                    const openIndex = fenceIndices[fenceIndices.length - 1]!;
                    const fenceLine = lines[openIndex] ?? '';
                    const afterTicks = fenceLine.replace(/^\s*```+/, '');
                    let lang = '';
                    let sameLineCode = '';
                    if (afterTicks.trim().length) {
                        const match = afterTicks.match(
                            /^([a-zA-Z0-9_-]+)(\s+|$)(.*)$/
                        );
                        if (match) {
                            lang = (match[1] || '').trim();
                            sameLineCode = (match[3] || '').trimEnd();
                        } else {
                            sameLineCode = afterTicks.trimEnd();
                        }
                    }
                    const codeLines =
                        openIndex + 1 < lines.length
                            ? lines.slice(openIndex + 1)
                            : [];
                    if (sameLineCode) codeLines.unshift(sameLineCode);
                    openFenceInfo = {
                        prefix:
                            openIndex > 0
                                ? lines.slice(0, openIndex).join('\n')
                                : '',
                        code: codeLines.join('\n'),
                        lang,
                    };
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

            // If we have an open fence, we only parse the prefix markdown; the partial code is handled manually.
            const toProcess = openFenceInfo
                ? openFenceInfo.prefix
                : preprocessed;
            const markdown = props.parseIncompleteMarkdown
                ? parseIncompleteMarkdown(toProcess)
                : toProcess;

            // First split into coarse blocks (only prefix portion if open fence in progress).
            let rawBlocks = parseBlocks(markdown);

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

            // Append partial open fence code block if present
            if (openFenceInfo) {
                const CodeComp =
                    (componentsMap['codeblock'] as any) || CodeBlock;
                vnodes.push(
                    h(CodeComp, {
                        code: openFenceInfo.code,
                        language: openFenceInfo.lang,
                        theme: props.shikiTheme,
                        actions: props.codeBlockActions,
                        showLineNumbers: props.codeBlockShowLineNumbers,
                        selectable: props.codeBlockSelectable,
                        hideCopy: props.codeBlockHideCopy,
                        hideDownload: props.codeBlockHideDownload,
                        'data-open-fence': 'true',
                        'data-streaming': 'true',
                    })
                );
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
