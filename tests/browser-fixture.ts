import {
    createApp,
    createSSRApp,
    defineComponent,
    h,
    nextTick,
    ref,
} from 'vue';
import {
    CodeBlock,
    MermaidBlock,
    StreamMarkdown,
    preloadMath,
    useShikiHighlighter,
} from '../index';
import { registerShikiLanguages } from '../src/shiki/registry';
import javascript from '@shikijs/langs/javascript';

registerShikiLanguages([{ id: 'javascript', loader: javascript }]);
const tick = async () => {
    await nextTick();
    await nextTick();
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (ok: unknown, message: string) => {
    if (!ok) throw new Error(message);
};
const escape = (text: string) =>
    text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
let app: ReturnType<typeof createApp> | undefined;
const root = document.querySelector<HTMLElement>('#app')!;
const dispose = () => {
    app?.unmount();
    app = undefined;
    root.replaceChildren();
};
const codeText = () => {
    const code = root
        .querySelector('[data-streamdown="code"]')
        ?.cloneNode(true) as HTMLElement | undefined;
    code?.querySelectorAll('[data-line-number]').forEach((node) =>
        node.remove(),
    );
    return code?.textContent;
};

const cases = {
    async highlighting() {
        const code = ref('const seed = 0;');
        const language = ref('javascript');
        const theme = ref('github-light');
        const pending: Array<{
            input: { code: string; language: string; theme: unknown };
            resolve: (html: string) => void;
            reject: (error: Error) => void;
        }> = [];
        const highlight = (input: any) =>
            new Promise<string>((resolve, reject) =>
                pending.push({ input, resolve, reject }),
            );
        app = createApp({
            render: () =>
                h(CodeBlock, {
                    code: code.value,
                    language: language.value,
                    theme: theme.value,
                    highlight,
                }),
        });
        app.mount(root);
        await tick();
        check(
            pending.length === 1,
            'the asynchronous provider must receive a mounted block',
        );
        const finish = async (index: number) => {
            const job = pending[index]!;
            job.resolve(
                `<pre data-theme="${job.input.theme}"><code>${job.input.code
                    .split('\n')
                    .map(
                        (line) =>
                            `<span class="line"><span>${escape(line)}</span></span>`,
                    )
                    .join('\n')}</code></pre>`,
            );
            await tick();
        };
        await finish(0);
        code.value += '\nconst second = 1;';
        await tick();
        code.value += '\nconst third = 2;';
        await tick();
        check(
            codeText() === code.value,
            'new text must stay readable while highlighting lags',
        );
        await finish(1);
        check(
            root.querySelector('pre')?.dataset.theme === 'github-light',
            'a valid completed prefix must commit during a faster stream',
        );
        check(
            codeText() === code.value,
            'an older prefix must not hide the live suffix',
        );
        await finish(2);

        // A stable selection must survive both a plaintext suffix and a highlighted result.
        const text = root.querySelector('code span span')!.firstChild!;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 5);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
        code.value += '\nconst fourth = 3;';
        await tick();
        await finish(3);
        check(
            getSelection()!.toString() === 'const',
            'streaming must retain the existing code selection',
        );

        code.value = 'old document';
        await tick();
        code.value = 'replacement';
        language.value = 'text';
        theme.value = 'github-dark';
        await tick();
        await finish(4);
        check(
            codeText() === 'replacement',
            'a stale document/language/theme result must be rejected',
        );
        await finish(5);
        check(
            root.querySelector('pre')?.dataset.theme === 'github-dark',
            'the current theme must win',
        );
        code.value += ' later';
        await tick();
        code.value += ' latest';
        await tick();
        await finish(7);
        await finish(6);
        check(
            codeText() === code.value,
            'out-of-order results must not rewind code',
        );
        code.value = '<img src=x onerror="window.__unsafe = true">';
        await tick();
        pending[8]!.reject(new Error('offline'));
        await tick();
        check(
            codeText() === code.value && !root.querySelector('img'),
            'failed highlighting must keep escaped current code',
        );
        code.value += ' pending';
        await tick();
        dispose();
        await finish(9);
        check(
            root.childNodes.length === 0,
            'an unmounted result must not restore a removed block',
        );
        return { requests: pending.length };
    },
    async grammar() {
        const code = ref('/* open comment\nconst answer = 42;');
        const theme = ref<any>('github-light');
        const selectable = ref(true);
        app = createApp({
            render: () =>
                h(CodeBlock, {
                    code: code.value,
                    language: 'javascript',
                    theme: theme.value,
                    showLineNumbers: true,
                    selectable: selectable.value,
                }),
        });
        app.mount(root);
        const highlighter = await useShikiHighlighter();
        const fixtures = [
            '/* open comment\nconst answer = 42;\n*/\nconst after = `value',
            '/* open comment\nconst answer = 42;\n*/\nconst after = `value\n${answer}`;',
            'const rewrite = "safe";\r\nconst next = 2;',
        ];
        for (const next of fixtures) {
            code.value = next;
            await tick();
            await delay(30);
            check(
                codeText() === next.replaceAll('\r\n', '\n'),
                'incremental code must preserve every source character',
            );
            const reference = document.createElement('div');
            reference.innerHTML = highlighter.codeToHtml(next, {
                lang: 'javascript',
                theme: 'github-light',
            });
            const colors = (node: ParentNode) =>
                [...node.querySelectorAll('code > .line')].map((line) =>
                    [
                        ...line.querySelectorAll(
                            'span:not([data-line-number])',
                        ),
                    ].map((span) => [
                        span.textContent,
                        (span as HTMLElement).style.color,
                    ]),
                );
            check(
                JSON.stringify(colors(root)) ===
                    JSON.stringify(colors(reference)),
                'incremental multiline grammar must match a full highlight',
            );
        }
        theme.value = { light: 'github-light', dark: 'github-dark' };
        await tick();
        await delay(30);
        check(
            root.querySelector('pre')?.classList.contains('shiki-themes'),
            'dual themes must survive the incremental path',
        );
        selectable.value = false;
        await tick();
        check(
            root.querySelector('pre')?.classList.contains('shiki-themes') &&
                root.querySelector('pre')?.classList.contains('select-none'),
            'selectability must retain dual-theme classes',
        );
        theme.value = 'github-light';
        await tick();
        await delay(30);
        check(
            !root.querySelector('pre')?.classList.contains('shiki-themes'),
            'switching back to a single theme must invalidate dual-theme output',
        );
        return { fixtures: fixtures.length };
    },
    async renderer() {
        const content = ref('Stable **bold** paragraph.\n\nActive paragraph');
        const mode = ref(true);
        const components = ref<any>({});
        app = createApp({
            render: () =>
                h(StreamMarkdown, {
                    content: content.value,
                    parseIncompleteMarkdown: mode.value,
                    components: components.value,
                }),
        });
        app.mount(root);
        await tick();
        const first = root.querySelector('p')!;
        const changed: MutationRecord[] = [];
        const observer = new MutationObserver((records) =>
            changed.push(...records),
        );
        observer.observe(first, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
        });
        for (let i = 0; i < 10; i++) {
            content.value += ' tail';
            await tick();
        }
        mode.value = false;
        await tick();
        observer.disconnect();
        check(
            first === root.querySelector('p') && changed.length === 0,
            'completed blocks must remain untouched through appends and stream completion',
        );
        components.value = {
            p: defineComponent({
                render: () => h('p', { 'data-custom': 'yes' }, 'override'),
            }),
        };
        await tick();
        check(
            root.querySelector('[data-custom="yes"]'),
            'changing component overrides must invalidate cached rendering',
        );
        components.value = {};
        content.value = 'paragraph\n-';
        mode.value = true;
        await tick();
        check(
            !root.querySelector('h2'),
            'a streaming lone dash must not flash a heading',
        );
        mode.value = false;
        await tick();
        check(
            root.querySelector('h2'),
            'completed Setext headings must retain Markdown semantics',
        );
        await preloadMath();
        content.value = '$$x^2$$';
        await tick();
        check(
            ![...root.querySelectorAll('[class]')].some((node) =>
                node.className.includes(','),
            ),
            'math must retain valid space-separated class names',
        );
        return { stableMutations: changed.length };
    },
    async overrides() {
        const content = ref(
            'Completed **paragraph** ![image](https://example.com/image.png).',
        );
        let completedRenders = 0;
        const imageStatus = ref('loading');
        const components = {
            img: defineComponent({
                setup:
                    (_props, { attrs }) =>
                    () =>
                        h('img', { ...attrs, title: imageStatus.value }),
            }),
            p: (_props: any, { slots }: any) => {
                const children = slots.default?.();
                const text = (nodes: any[]): string =>
                    nodes
                        .map((node) =>
                            typeof node.children === 'string'
                                ? node.children
                                : Array.isArray(node.children)
                                  ? text(node.children)
                                  : '',
                        )
                        .join('');
                if (text(children ?? []).includes('Completed'))
                    completedRenders++;
                return h('p', children);
            },
        };
        app = createApp({
            render: () =>
                h(StreamMarkdown, { content: content.value, components }),
        });
        app.mount(root);
        await tick();
        content.value += '\n\nActive tail';
        await tick();
        const initial = completedRenders;
        for (let i = 0; i < 8; i++) {
            content.value += ' token';
            await tick();
        }
        check(
            completedRenders === initial,
            'an image override must not rerender completed custom components',
        );
        imageStatus.value = 'loaded';
        await tick();
        check(
            root.querySelector('img')?.title === 'loaded',
            'memoized blocks must preserve custom component reactivity',
        );
        return { initial, completedRenders };
    },
    async completedBlocks() {
        const prefix = '2 * 3 = 6\n\nsnake_case\n\n';
        const content = ref(prefix + 'Active tail');
        const mode = ref(true);
        app = createApp({
            render: () =>
                h(StreamMarkdown, {
                    content: content.value,
                    parseIncompleteMarkdown: mode.value,
                }),
        });
        app.mount(root);
        await tick();
        const paragraphs = () =>
            [...root.querySelectorAll('p')]
                .slice(0, 2)
                .map((node) => node.textContent);
        check(
            JSON.stringify(paragraphs()) ===
                JSON.stringify(['2 * 3 = 6', 'snake_case']),
            'completed paragraphs must not acquire synthetic markers',
        );
        const before = [...root.querySelectorAll('p')].slice(0, 2);
        content.value += ' extended';
        await tick();
        mode.value = false;
        await tick();
        check(
            before.every(
                (node, index) => node === root.querySelectorAll('p')[index],
            ),
            'finalization must retain completed paragraphs',
        );
        check(
            JSON.stringify(paragraphs()) ===
                JSON.stringify(['2 * 3 = 6', 'snake_case']),
            'finalization must not change completed literal text',
        );
        content.value = '2 * 3 = 6\n\n```text\nactive';
        mode.value = true;
        await tick();
        check(
            root.querySelector('p')?.textContent === '2 * 3 = 6',
            'the paragraph before an open fence is complete',
        );
        return { paragraphs: paragraphs() };
    },
    async mermaid() {
        const content = ref('```mermaid\ngraph TD\nA --> B');
        app = createApp({
            render: () => h(StreamMarkdown, { content: content.value }),
        });
        app.mount(root);
        await tick();
        check(
            root
                .querySelector('[data-streamdown="mermaid"] pre')
                ?.textContent?.includes('A --> B'),
            'streaming diagrams must retain their readable source',
        );
        content.value += '\n```';
        await tick();
        check(
            root.querySelector('[data-streamdown="mermaid"] pre'),
            'a closed diagram must retain source height while SVG loads',
        );
        const diagramSelector = '[data-streamdown="mermaid"] > div > svg';
        for (let i = 0; i < 100 && !root.querySelector(diagramSelector); i++)
            await delay(30);
        check(
            root.querySelector(diagramSelector),
            'a completed diagram must resolve to SVG',
        );
        content.value = '```mermaid\ngraph TD\nC --> D\n```';
        await tick();
        for (
            let i = 0;
            i < 100 &&
            ![...root.querySelectorAll('.nodeLabel')].some(
                (node) => node.textContent === 'C',
            );
            i++
        )
            await delay(30);
        check(
            [...root.querySelectorAll('.nodeLabel')].some(
                (node) => node.textContent === 'C',
            ),
            'editing a diagram must replace its old SVG',
        );
        const height = root
            .querySelector(diagramSelector)!
            .getBoundingClientRect().height;
        dispose();
        const code = 'graph TD\nC --> D\n';
        app = createApp({
            render: () =>
                h('section', [
                    h(MermaidBlock, { code }),
                    h(MermaidBlock, { code }),
                ]),
        });
        app.mount(root);
        await tick();
        check(
            root.querySelectorAll(diagramSelector).length === 2 &&
                !root.querySelector('pre'),
            'cached diagrams must remount before paint without a source placeholder',
        );
        const ids = [...root.querySelectorAll('svg [id], svg[id]')].map(
            (node) => node.id,
        );
        check(
            new Set(ids).size === ids.length,
            'simultaneous cached diagrams must have distinct SVG ids',
        );
        for (const svg of root.querySelectorAll(diagramSelector)) {
            check(
                Math.abs(svg.getBoundingClientRect().height - height) <= 1,
                'cached diagrams must retain their rendered height',
            );
            for (const node of svg.querySelectorAll('*')) {
                for (const attribute of [...node.attributes]) {
                    const targets = [
                        ...attribute.value.matchAll(
                            /url\(["']?#([^"')]+)["']?\)/g,
                        ),
                    ].map((match) => match[1]);
                    if (
                        attribute.name === 'href' &&
                        attribute.value.startsWith('#')
                    )
                        targets.push(attribute.value.slice(1));
                    for (const target of targets)
                        check(
                            svg.querySelector(`[id="${target}"]`),
                            'cached SVG references must resolve within their own diagram',
                        );
                }
            }
        }
        return { rendered: true, cachedCopies: 2, uniqueIds: ids.length };
    },
    async hydration() {
        dispose();
        root.innerHTML =
            '<div class="streamdown-vue space-y-4"><h1 class="text-3xl font-bold" data-streamdown="h1">Hydration check</h1></div>';
        const warnings: string[] = [];
        app = createSSRApp(StreamMarkdown, { content: '# Hydration check' });
        app.config.warnHandler = (message) => warnings.push(message);
        app.mount(root);
        await tick();
        check(
            !warnings.some((message) => /hydrat/i.test(message)),
            'native rendering must hydrate existing SSR output',
        );
        return { warnings };
    },
};

(window as any).__streamdownRegressions = async (name: keyof typeof cases) => {
    dispose();
    try {
        return await cases[name]();
    } finally {
        dispose();
    }
};
