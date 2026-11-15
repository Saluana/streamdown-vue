import {
    defineComponent,
    h,
    onBeforeUnmount,
    shallowRef,
    type VNode,
    isVNode,
    withMemo,
} from 'vue';
import type { PropType } from 'vue';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import type { Element, Root, Text } from 'hast';
import { getRehypeKatex, preloadMath } from './math';
import CodeBlock from './components/CodeBlock';
import MermaidBlock from './components/MermaidBlock';
import defaultComponents, { type ComponentMap } from './components/components';
import { parseBlocks } from '../lib/parse-blocks';
import {
    closeOpenInlineCode,
    parseIncompleteMarkdown,
} from '../lib/parse-incomplete-markdown';
import { normalizeLatexOutsideCode } from '../lib/latex-utils';
import {
    hardenHref,
    hardenSrc,
    type HardenOptions,
} from './security/harden-vue-markdown';
import type { ShikiThemeConfig } from './types';
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
        shikiTheme: {
            type: [String, Object] as PropType<ShikiThemeConfig>,
            default: undefined,
        },
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
        const processorHasCustomPlugins =
            props.remarkPlugins.length > 0 || props.rehypePlugins.length > 0;

        // KaTeX loads on demand (see ./math). Until it has loaded the pipeline
        // runs without `rehype-katex`, math renders as its TeX source, and the
        // processor is rebuilt with KaTeX once it arrives.
        const buildProcessor = () => {
            const next = unified()
                .use(ensurePlugin(remarkParse))
                .use(ensurePlugin(remarkGfm));

            // Default: include remark-math but disable single-dollar inline math so currency like $390K is safe.
            if (!userSuppliesRemarkMath) {
                next.use(ensurePlugin(remarkMath), {
                    singleDollarTextMath: false,
                });
            }

            // Support [plugin, options] tuples for remark plugins
            props.remarkPlugins.forEach((entry: any) => {
                if (Array.isArray(entry)) {
                    const [plugin, options] = entry;
                    next.use(ensurePlugin(plugin), options);
                } else {
                    next.use(ensurePlugin(entry));
                }
            });

            next.use(ensurePlugin(remarkRehype), { allowDangerousHtml: false });
            const rehypeKatex = getRehypeKatex();
            if (rehypeKatex) next.use(ensurePlugin(rehypeKatex));

            // Support [plugin, options] tuples for rehype plugins (deduped loop)
            props.rehypePlugins.forEach((entry: any) => {
                if (Array.isArray(entry)) {
                    const [plugin, options] = entry;
                    next.use(ensurePlugin(plugin), options);
                } else {
                    next.use(ensurePlugin(entry));
                }
            });
            return { processor: next, hasKatex: Boolean(rehypeKatex) };
        };
        let { processor, hasKatex: processorHasKatex } = buildProcessor();
        // Bumped when KaTeX finishes loading so math waiting on it re-renders.
        const mathVersion = shallowRef(0);
        let disposed = false;

        // remark-rehype emits math as `code.language-math` (inside `pre` for
        // display math). rehype-katex replaces those nodes, so any left over
        // mean the content has math that KaTeX has not rendered yet.
        const isMathCode = (node: any) =>
            node?.type === 'element' &&
            node.tagName === 'code' &&
            ((node.properties?.className || []) as string[]).includes(
                'language-math'
            );
        const containsMath = (node: any): boolean =>
            isMathCode(node) ||
            (Array.isArray(node?.children) && node.children.some(containsMath));

        const hardenOptions: HardenOptions = {
            allowedImagePrefixes: props.allowedImagePrefixes,
            allowedLinkPrefixes: props.allowedLinkPrefixes,
            defaultOrigin: props.defaultOrigin,
        };

        let componentsMap: ComponentMap = {
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
            const nodeProps: any = Object.fromEntries(
                Object.entries(el.properties || {}).map(([key, value]) => [
                    key === 'className' && !props.components[el.tagName]
                        ? 'class'
                        : key,
                    Array.isArray(value) ? [...value] : value,
                ])
            );
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
                // Display math waiting for KaTeX: show the TeX source plainly
                // rather than as a code block with copy/download controls.
                if (lang === 'math') {
                    return h('pre', { 'data-streamdown': 'math-pending' }, [
                        h('code', { class: className }, code),
                    ]);
                }
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

            // Inline math waiting for KaTeX keeps its `code` element.
            if (isMathCode(el)) nodeProps['data-streamdown'] = 'math-pending';

            const comp = componentsMap[tag];
            if (comp) {
                if (comp === defaultComponents[tag] && !props.components[tag]) {
                    return comp(nodeProps, {
                        slots: { default: () => children },
                    });
                }
                return createVNode(comp, nodeProps, children);
            }
            return createVNode(tag, nodeProps, children);
        };

        // --- Per-instance parsed-block cache (internal) ---
        // Retains the previous effective source and the HAST roots of completed
        // blocks so unchanged blocks can skip Unified/KaTeX work on append-only
        // updates. Cached trees stay read-only; completed VNodes are reused only
        // while the render/security context remains unchanged.
        const memoizeCompleted = (nodes: any[]): any[] => {
            const cache: VNode[] = [];
            return nodes.map((node, index) =>
                isVNode(node) ? withMemo([], () => node, cache, index) : node
            );
        };
        type CachedBlock = {
            input: string;
            tree: Root;
            vnodes: VNode[];
            context: unknown[];
            completed: boolean;
        };
        const parseCache: {
            source: string | null;
            records: CachedBlock[];
        } = {
            source: null,
            records: [],
        };

        // Link reference definitions (including footnotes) are document-global and
        // can reinterpret earlier blocks, so any definition-like line disables
        // reuse for the whole document. The pattern is intentionally over-broad:
        // false positives only lose the fast path.
        const referenceDefinitionPattern =
            /(?:^|\n)[ \t]*(?:>[ \t]*|[-+*][ \t]+|\d{1,9}[.)][ \t]+)*\[[^\]\n]+\]:/;

        const isWhitespaceBlock = (block: string) => block.trim().length === 0;

        // Release the current document's parsed trees as soon as the component
        // unmounts. The cache never holds prior documents or other instances.
        onBeforeUnmount(() => {
            disposed = true;
            parseCache.records.length = 0;
            parseCache.source = null;
        });

        return () => {
            // Read so this component re-renders when KaTeX finishes loading.
            void mathVersion.value;
            // KaTeX became available (loaded here or by another instance):
            // rebuild with it and drop trees parsed without it.
            if (!processorHasKatex && getRehypeKatex()) {
                ({ processor, hasKatex: processorHasKatex } = buildProcessor());
                parseCache.records = [];
                parseCache.source = null;
            }
            componentsMap = { ...defaultComponents, ...props.components };
            hardenOptions.allowedImagePrefixes = props.allowedImagePrefixes;
            hardenOptions.allowedLinkPrefixes = props.allowedLinkPrefixes;
            hardenOptions.defaultOrigin = props.defaultOrigin;
            const renderContext: unknown[] = [
                ...Object.entries(props.components).flat(),
                ...props.allowedImagePrefixes,
                null,
                ...props.allowedLinkPrefixes,
                props.defaultOrigin,
                JSON.stringify(props.shikiTheme),
                props.codeBlockShowLineNumbers,
                props.codeBlockSelectable,
                props.codeBlockHideCopy,
                props.codeBlockHideDownload,
                ...props.codeBlockActions,
            ];
            const sameRenderContext = (previous: unknown[]) =>
                previous.length === renderContext.length &&
                previous.every(
                    (value, index) => value === renderContext[index]
                );
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

            // Light LaTeX preprocessing (matrix row breaks + bracket math + display math)
            // that leaves Markdown code literal. Code is located with this processor's
            // parser; when incomplete markdown is repaired, a dangling backtick is closed
            // first so a streaming code span is protected before its closer arrives.
            const applyLatexPreprocessing = (raw: string): string =>
                normalizeLatexOutsideCode(raw, (text) =>
                    processor.parse(
                        props.parseIncompleteMarkdown
                            ? closeOpenInlineCode(text)
                            : text
                    )
                );

            // Decide whether this render may reuse cached completed blocks.
            const referencesPresent =
                referenceDefinitionPattern.test(markdownSrc);
            const appendOnly =
                parseCache.source !== null &&
                markdownSrc.startsWith(parseCache.source);
            const cacheEligible =
                !processorHasCustomPlugins && !referencesPresent;
            const canReuse = cacheEligible && appendOnly;

            // Preprocess only the slice fed to the markdown processor. With an open fence
            // that is the prefix, which still needs preprocessing so bracket display math
            // (\[ ... \]) and matrices continue to render. Previously the raw unprocessed
            // prefix was used which caused already rendered KaTeX to "disappear" as soon
            // as a progressive code fence opened.
            let sourceToProcess = openFenceInfo
                ? openFenceInfo.prefix
                : markdownSrc;
            // A lone trailing '-' is ambiguous with a list item while streaming.
            // Delay that underline until another token arrives; final mode still
            // uses the exact source and renders genuine Setext headings.
            if (props.parseIncompleteMarkdown)
                sourceToProcess = sourceToProcess.replace(
                    /\n {0,3}-[ \t]*$/,
                    ''
                );
            const toProcess = applyLatexPreprocessing(sourceToProcess);

            // First split into coarse blocks (only prefix portion if open fence in progress).
            let rawBlocks = parseBlocks(toProcess);

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

            // Only the growing tail needs repair. Completed
            // blocks retain identical source (including code whitespace) when
            // final mode is selected, so their parsed trees remain reusable.
            const lastMeaningfulIndex = merged.findLastIndex(
                (block) => !isWhitespaceBlock(block)
            );
            let blocks = merged.map((block, index) =>
                props.parseIncompleteMarkdown &&
                !openFenceInfo &&
                index === lastMeaningfulIndex
                    ? parseIncompleteMarkdown(block.trimEnd())
                    : block
            );

            // Reuse is decided here, at the final prepared-input/processor
            // boundary, and only for an unbroken prefix of records whose exact
            // parser input still matches. Any earlier or uncertain change stops
            // reuse from that position onward (full reparse). The last
            // non-whitespace block is always reparsed even when synthetic repairs
            // make it look closed.
            //
            // Assumptions future changes must preserve:
            // - preprocessing, block splitting/merging, and per-block repair stay
            //   authoritative; the cache is a pure function of their output;
            // - the processor is stateless across blocks (custom remark/rehype
            //   plugins bypass the cache entirely);
            // - cached HAST is never mutated; renderChildren only reads it.
            // Rerun the differential tests in __tests__/parse-cache.test.ts and
            // the browser profiles after changing any of these stages.
            // Terminal newlines outside a completed block do not affect its
            // Markdown tree. Normalize only completed inputs, retaining spaces
            // and the active tail's exact code/newline semantics.
            blocks = blocks.map((input, index) =>
                index < lastMeaningfulIndex ? input.replace(/\n+$/, '') : input
            );
            let reuseCount = 0;
            if (canReuse) {
                const limit = Math.min(
                    parseCache.records.length,
                    blocks.length
                );
                while (
                    reuseCount < limit &&
                    reuseCount < lastMeaningfulIndex &&
                    parseCache.records[reuseCount]!.input === blocks[reuseCount]
                ) {
                    reuseCount++;
                }
            }

            const nextRecords: CachedBlock[] = [];
            const vnodes: any[] = [];
            let needsMath = false;
            for (let i = 0; i < blocks.length; i++) {
                const input = blocks[i]!;
                if (i < reuseCount) {
                    const record = parseCache.records[i]!;
                    if (cacheEligible) nextRecords.push(record);
                    if (
                        !record.completed ||
                        !sameRenderContext(record.context)
                    ) {
                        record.vnodes = memoizeCompleted(
                            renderChildren(record.tree.children as any[])
                        );
                        record.context = renderContext;
                        record.completed = true;
                    }
                    vnodes.push(...record.vnodes);
                    continue;
                }
                const tree = processor.runSync(processor.parse(input)) as Root;
                if (!processorHasKatex && !needsMath)
                    needsMath = containsMath(tree);
                const nodes = renderChildren(tree.children as any[]);
                const completed =
                    i < lastMeaningfulIndex || Boolean(openFenceInfo);
                const rendered = completed ? memoizeCompleted(nodes) : nodes;
                if (cacheEligible)
                    nextRecords.push({
                        input,
                        tree,
                        vnodes: rendered,
                        context: renderContext,
                        completed,
                    });
                vnodes.push(...rendered);
            }
            parseCache.records = cacheEligible ? nextRecords : [];
            parseCache.source = markdownSrc;

            // First math seen without KaTeX: load it, then re-render. A failed
            // load leaves the TeX source shown; the next render with math retries.
            if (needsMath) {
                preloadMath().then(
                    () => {
                        if (!disposed) mathVersion.value++;
                    },
                    () => {}
                );
            }

            // Append partial open fence code block if present
            if (openFenceInfo) {
                const CodeComp =
                    (componentsMap['codeblock'] as any) || CodeBlock;
                vnodes.push(
                    openFenceInfo.lang === 'mermaid'
                        ? h(MermaidBlock, {
                              code: openFenceInfo.code,
                              streaming: true,
                          })
                        : h(CodeComp, {
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
