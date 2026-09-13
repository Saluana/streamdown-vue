import { afterAll, describe, expect, it, mock } from 'bun:test';
import {
    createRenderer,
    createTextVNode,
    defineComponent,
    h,
    nextTick,
    ref,
} from 'vue';
import type { Plugin } from 'unified';
import * as realUnifiedNs from 'unified';

// Wrap `unified` before StreamMarkdown is imported so we can count real
// parse/runSync calls and selectively deep-freeze returned HAST roots. Freezing
// makes accidental cached-tree mutation throw (ES modules are strict mode).
const realUnified = realUnifiedNs.unified;

let parseCalls = 0;
let runCalls = 0;
let freezeParsedTrees = false;
let frozenTreeCount = 0;

const deepFreeze = (value: any): void => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
};

mock.module('unified', () => ({
    unified: (...args: any[]) => {
        const processor: any = (realUnified as any)(...args);
        const originalParse = processor.parse.bind(processor);
        const originalRunSync = processor.runSync.bind(processor);
        processor.parse = (...callArgs: any[]) => {
            parseCalls += 1;
            return originalParse(...callArgs);
        };
        processor.runSync = (...callArgs: any[]) => {
            runCalls += 1;
            const tree = originalRunSync(...callArgs);
            if (freezeParsedTrees) {
                deepFreeze(tree);
                frozenTreeCount += 1;
            }
            return tree;
        };
        return processor;
    },
}));

const { StreamMarkdown } = await import('../src/StreamMarkdown');

afterAll(() => {
    freezeParsedTrees = false;
    mock.module('unified', () => ({
        ...realUnifiedNs,
        unified: realUnified,
    }));
});

// The bypass instance uses a no-op plugin: identical parse semantics, but any
// presence of a custom plugin disables reuse, giving us the production
// full-parse pipeline as the differential oracle.
const noopPlugin: Plugin = () => {};

const PlainCode = defineComponent({
    name: 'PlainCode',
    props: {
        code: { type: String, default: '' },
        language: { type: String, default: '' },
    },
    setup(props) {
        return () =>
            h('pre', { class: 'plain-code', 'data-language': props.language }, [
                h('code', props.code),
            ]);
    },
});

// --- Minimal host renderer (no DOM dependency) ---

interface HostNode {
    tag: string;
    props: Record<string, unknown>;
    children: HostNode[];
    text?: string;
    parent: HostNode | null;
}

const createHostNode = (tag: string, text?: string): HostNode => ({
    tag,
    props: {},
    children: [],
    text,
    parent: null,
});

const nodeOps: any = {
    insert(child: HostNode, parent: HostNode, anchor?: HostNode | null) {
        child.parent = parent;
        if (!anchor) {
            parent.children.push(child);
            return;
        }
        const index = parent.children.indexOf(anchor);
        if (index === -1) parent.children.push(child);
        else parent.children.splice(index, 0, child);
    },
    remove(child: HostNode) {
        const parent = child.parent;
        if (!parent) return;
        const index = parent.children.indexOf(child);
        if (index !== -1) parent.children.splice(index, 1);
        child.parent = null;
    },
    patchProp(el: HostNode, key: string, _prev: unknown, next: unknown) {
        el.props[key] = next;
    },
    createElement(tag: string) {
        return createHostNode(tag);
    },
    createText(text: string) {
        return createHostNode('#text', text);
    },
    createComment(text: string) {
        return createHostNode('#comment', text);
    },
    setText(node: HostNode, text: string) {
        node.text = text;
    },
    setElementText(node: HostNode, text: string) {
        node.children = [createHostNode('#text', text)];
    },
    parentNode(node: HostNode) {
        return node.parent;
    },
    nextSibling(node: HostNode) {
        const parent = node.parent;
        if (!parent) return null;
        const index = parent.children.indexOf(node);
        return parent.children[index + 1] ?? null;
    },
    querySelector() {
        return null;
    },
    setScopeId(el: HostNode, id: string) {
        el.props[id] = '';
    },
    cloneNode(node: HostNode) {
        return createHostNode(node.tag, node.text);
    },
    insertStaticContent(
        content: string,
        parent: HostNode,
        anchor: HostNode | null
    ) {
        const node = createHostNode('#static', content);
        nodeOps.insert(node, parent, anchor);
        return [node, node];
    },
};

const renderer = (createRenderer as any)(nodeOps);

const serializeValue = (value: unknown): string => {
    if (value == null || value === false || typeof value === 'function') {
        return '';
    }
    if (Array.isArray(value)) return value.map(serializeValue).join(' ');
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, entry]) => `${key}:${serializeValue(entry)}`);
        return `{${entries.join(',')}}`;
    }
    return String(value);
};

const serialize = (node: HostNode): string => {
    if (node.tag === '#text') return node.text ?? '';
    if (node.tag === '#comment') return `<!--${node.text ?? ''}-->`;
    if (node.tag === '#static') return node.text ?? '';
    const attrs = Object.entries(node.props)
        .filter(
            ([key, value]) =>
                !key.startsWith('on') && typeof value !== 'function'
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => ` ${key}="${serializeValue(value)}"`)
        .join('');
    return `<${node.tag}${attrs}>${node.children
        .map(serialize)
        .join('')}</${node.tag}>`;
};

interface InstanceSpec {
    initialContent?: string;
    props?: () => Record<string, unknown>;
    slot?: () => string;
}

const mountInstances = (specs: InstanceSpec[]) => {
    const contents = specs.map((spec) => ref(spec.initialContent ?? ''));
    const slotTexts = specs.map(() => ref(''));
    const Root = defineComponent({
        setup() {
            return () =>
                h(
                    'div',
                    { class: 'root' },
                    specs.map((spec, index) =>
                        h(
                            StreamMarkdown,
                            {
                                content: contents[index]!.value,
                                ...(spec.props ? spec.props() : {}),
                            },
                            spec.slot
                                ? {
                                      default: () => [
                                          createTextVNode(
                                              slotTexts[index]!.value
                                          ),
                                      ],
                                  }
                                : undefined
                        )
                    )
                );
        },
    });
    const container = createHostNode('container');
    const app = renderer.createApp(Root);
    app.mount(container);
    return {
        container,
        app,
        async setContents(next: string[]) {
            next.forEach((text, index) => {
                contents[index]!.value = text;
            });
            await nextTick();
        },
        async setSlotText(index: number, text: string) {
            slotTexts[index]!.value = text;
            await nextTick();
        },
        instances(): HostNode[] {
            return container.children[0]!.children;
        },
    };
};

const cachedSpec = (extra: () => Record<string, unknown> = () => ({})): InstanceSpec => ({
    props: () => ({
        components: { codeblock: PlainCode },
        ...extra(),
    }),
});

const bypassSpec = (extra: () => Record<string, unknown> = () => ({})): InstanceSpec => ({
    props: () => ({
        components: { codeblock: PlainCode },
        remarkPlugins: [noopPlugin],
        ...extra(),
    }),
});

const assertMatchesBypass = async (
    chunks: string[],
    options: {
        cached?: InstanceSpec;
        bypass?: InstanceSpec;
        afterChunk?: (cachedNode: HostNode, bypassNode: HostNode, accumulated: string) => void;
    } = {}
) => {
    const cached = mountInstances([options.cached ?? cachedSpec()]);
    const bypass = mountInstances([options.bypass ?? bypassSpec()]);
    let accumulated = '';
    try {
        for (const chunk of chunks) {
            accumulated += chunk;
            await cached.setContents([accumulated]);
            await bypass.setContents([accumulated]);
            const [cachedNode] = cached.instances();
            const [bypassNode] = bypass.instances();
            expect(serialize(cachedNode!)).toBe(serialize(bypassNode!));
            options.afterChunk?.(cachedNode!, bypassNode!, accumulated);
        }
    } finally {
        cached.app.unmount();
        bypass.app.unmount();
    }
};

const progressiveFixtures: Record<string, string[]> = {
    paragraphs: [
        'First paragraph with **bold** and `code`.',
        '\n\nSecond paragraph starts here',
        ' and continues with a [link](https://example.com) and more words.',
        '\n\nThird paragraph with *italic* text.',
    ],
    math: [
        'Intro text.\n\n$$',
        '\nx^2 + y^2 = z^2',
        '\n$$\n\n',
        '$$\n\\begin{matrix} 1 & 2',
        ' \\\\ 3 & 4 \\end{matrix}\n$$',
        '\n\nFinal paragraph.',
    ],
    lists: [
        'Items follow:\n\n- first item',
        '\n- second item',
        '\n  - nested item\n  - nested two',
        '\n- third item\n\n',
        'Paragraph after list.',
    ],
    table: [
        '| Column A | Column B |\n',
        '| --- | --- |\n',
        '| one | two |\n',
        '| three | four |\n\n',
        'After the table.',
    ],
    headings: [
        'Setext heading incoming\n',
        '=',
        '=\n\nNormal paragraph',
        ' continues.',
        '\n\n# ATX heading\n\nDone.',
    ],
    inline: [
        'Partial link [example](https://ex',
        'ample.com) and partial **bo',
        'ld** then `co',
        'de` and ~~str',
        'ike~~ done.',
    ],
    fence: [
        'Before fence.\n\n```ts\n',
        'const a = 1;\n',
        'const b = 2;\n',
        '```\n\n',
        'After fence.',
    ],
    mixed: [
        '# Mixed document\n\n',
        'Paragraph with a [partial link](https://exa',
        'mple.com) and **bold start',
        '** close.\n\n- list item one',
        '\n- list item two\n  - nested\n\n',
        '> quote line one\n> quote line two\n\n',
        '$$\n\\begin{pmatrix} a & b',
        ' \\\\ c & d \\end{pmatrix}\n$$\n\n',
        '| h1 | h2 |\n| --- | --- |\n| a | b |\n\n',
        '```js\nconst partial = 1;\n```\n\n',
        'Final paragraph.',
    ],
};

describe('parse cache differential output', () => {
    for (const [name, chunks] of Object.entries(progressiveFixtures)) {
        it(`matches the bypassed production pipeline at every chunk: ${name}`, async () => {
            await assertMatchesBypass(chunks);
        });
    }

    it('matches bypassed output for edits, truncation, and resets', async () => {
        const steps = [
            'Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.',
            'Beta paragraph.\n\nGamma paragraph.',
            'Beta paragraph.\n\nGamma paragraph.\n\nDelta paragraph.',
            'Delta paragraph.',
            '',
            'Fresh content after reset.',
        ];
        const cached = mountInstances([cachedSpec()]);
        const bypass = mountInstances([bypassSpec()]);
        try {
            for (const step of steps) {
                await cached.setContents([step]);
                await bypass.setContents([step]);
                expect(serialize(cached.instances()[0]!)).toBe(
                    serialize(bypass.instances()[0]!)
                );
            }
        } finally {
            cached.app.unmount();
            bypass.app.unmount();
        }
    });

    it('matches bypassed output when parse mode changes mid-stream', async () => {
        const mode = ref(true);
        const cached = mountInstances([
            cachedSpec(() => ({ parseIncompleteMarkdown: mode.value })),
        ]);
        const bypass = mountInstances([
            bypassSpec(() => ({ parseIncompleteMarkdown: mode.value })),
        ]);
        try {
            await cached.setContents(['Start **bold']);
            await bypass.setContents(['Start **bold']);
            expect(serialize(cached.instances()[0]!)).toBe(
                serialize(bypass.instances()[0]!)
            );
            mode.value = false;
            await nextTick();
            expect(serialize(cached.instances()[0]!)).toBe(
                serialize(bypass.instances()[0]!)
            );
            await cached.setContents(['Start **bold and more']);
            await bypass.setContents(['Start **bold and more']);
            expect(serialize(cached.instances()[0]!)).toBe(
                serialize(bypass.instances()[0]!)
            );
            mode.value = true;
            await nextTick();
            expect(serialize(cached.instances()[0]!)).toBe(
                serialize(bypass.instances()[0]!)
            );
        } finally {
            cached.app.unmount();
            bypass.app.unmount();
        }
    });

    it('matches bypassed output for slot-driven content', async () => {
        const cached = mountInstances([{ ...cachedSpec(), slot: () => '' }]);
        const bypass = mountInstances([{ ...bypassSpec(), slot: () => '' }]);
        try {
            await cached.setSlotText(0, 'Slot **content** one');
            await bypass.setSlotText(0, 'Slot **content** one');
            expect(serialize(cached.instances()[0]!)).toBe(
                serialize(bypass.instances()[0]!)
            );
            await cached.setSlotText(0, 'Slot **content** one extended');
            await bypass.setSlotText(0, 'Slot **content** one extended');
            expect(serialize(cached.instances()[0]!)).toBe(
                serialize(bypass.instances()[0]!)
            );
        } finally {
            cached.app.unmount();
            bypass.app.unmount();
        }
    });

    it('bypasses reuse for late reference definitions without changing parser semantics', async () => {
        const step1 = 'See [the doc][doc] for details.';
        const step2 = step1 + '\n\n[doc]: https://example.com/doc';
        const step3 = step2 + '\n\nAfter.';
        const cached = mountInstances([cachedSpec()]);
        runCalls = 0;
        try {
            await cached.setContents([step1]);
            expect(runCalls).toBe(1);
            await cached.setContents([step2]);
            // Per-block parsing means the definition does not resolve the earlier
            // reference (current semantics are preserved); the document simply
            // bypasses the cache and every block parses again.
            expect(runCalls - 1).toBe(3);
            await cached.setContents([step3]);
            expect(runCalls).toBe(1 + 3 + 5);
            const html = serialize(cached.instances()[0]!);
            expect(html).toContain('[the doc][doc]');
        } finally {
            cached.app.unmount();
        }
    });

    it('reparses after footnote definitions arrive', async () => {
        const step1 = 'Text with a footnote reference[^1].';
        const step2 = step1 + '\n\n[^1]: Footnote body.';
        await assertMatchesBypass([step1, step2]);
    });

    it('keeps repeated identical blocks as separate positions', async () => {
        const chunks = ['same block\n\n', 'same block\n\n', 'same block'];
        const cached = mountInstances([cachedSpec()]);
        try {
            let accumulated = '';
            for (const chunk of chunks) {
                accumulated += chunk;
                await cached.setContents([accumulated]);
            }
            const html = serialize(cached.instances()[0]!);
            const occurrences = html.split('>same block<').length - 1;
            expect(occurrences).toBe(3);
        } finally {
            cached.app.unmount();
        }
    });

    it('does not share cached state between instances with different security settings', async () => {
        const content = '![blocked](http://cdn.example.com/a.png)\n\nParagraph one.\n\nParagraph two.';
        const first = mountInstances([
            cachedSpec(() => ({ allowedImagePrefixes: ['https://'] })),
        ]);
        const second = mountInstances([
            cachedSpec(() => ({
                allowedImagePrefixes: ['https://', 'http://'],
            })),
        ]);
        try {
            await first.setContents([content]);
            await second.setContents([content]);
            const firstHtml = serialize(first.instances()[0]!);
            const secondHtml = serialize(second.instances()[0]!);
            expect(firstHtml).not.toContain('<img');
            expect(secondHtml).toContain('<img');
            await first.setContents([content + ' extended']);
            await second.setContents([content + ' extended']);
            expect(serialize(first.instances()[0]!)).not.toContain('<img');
            expect(serialize(second.instances()[0]!)).toContain('<img');
        } finally {
            first.app.unmount();
            second.app.unmount();
        }
    });

    it('renders every parsed tree from a frozen cache without mutation', async () => {
        freezeParsedTrees = true;
        frozenTreeCount = 0;
        try {
            await assertMatchesBypass(progressiveFixtures.mixed!);
            expect(frozenTreeCount).toBeGreaterThan(0);
        } finally {
            freezeParsedTrees = false;
        }
    });

    it('does not expose cached property arrays to custom components', async () => {
        const receivedClasses: string[][] = [];
        const MutatingListItem = (props: any, { slots }: any) => {
            const classes = props.className as string[];
            receivedClasses.push([...classes]);
            classes.push('mutated-by-consumer');
            return h('li', {}, slots.default?.());
        };
        const harness = mountInstances([
            cachedSpec(() => ({ components: { li: MutatingListItem } })),
        ]);
        try {
            await harness.setContents(['- [ ] task\n\nActive paragraph']);
            await harness.setContents([
                '- [ ] task\n\nActive paragraph extended',
            ]);
            expect(receivedClasses.length).toBeGreaterThan(1);
            for (const classes of receivedClasses) {
                expect(classes).toContain('task-list-item');
                expect(classes).not.toContain('mutated-by-consumer');
            }
        } finally {
            harness.app.unmount();
        }
    });
});

describe('parse cache reuse accounting', () => {
    const stableParagraphs = (count: number) =>
        Array.from(
            { length: count },
            (_, index) =>
                `Stable paragraph ${index} with enough text to be a real block.`
        ).join('\n\n');

    it('does not reparse the completed prefix when only the tail changes', async () => {
        const results: Array<{
            blocks: number;
            afterSetup: number;
            tail: number;
        }> = [];
        for (const blocks of [10, 1000]) {
            const prefix = stableParagraphs(blocks);
            const harness = mountInstances([cachedSpec()]);
            parseCalls = 0;
            runCalls = 0;
            await harness.setContents([`${prefix}\n\nactive paragraph`]);
            const afterSetup = runCalls;
            for (let step = 0; step < 20; step++) {
                await harness.setContents([
                    `${prefix}\n\nactive paragraph ${'x'.repeat(step + 1)}`,
                ]);
            }
            results.push({ blocks, afterSetup, tail: runCalls - afterSetup });
            harness.app.unmount();
        }
        expect(results[0]!.tail).toBe(results[1]!.tail);
        expect(results[1]!.tail).toBeLessThanOrEqual(21);
        expect(results[0]!.afterSetup).toBe(21);
        expect(results[1]!.afterSetup).toBe(2001);
    }, 60000);

    it('reuses a paragraph once a following real boundary exists', async () => {
        const harness = mountInstances([cachedSpec()]);
        parseCalls = 0;
        runCalls = 0;
        try {
            await harness.setContents(['First paragraph']);
            expect(runCalls).toBe(1);
            await harness.setContents(['First paragraph\n\nSecond paragraph']);
            expect(runCalls).toBe(3);
            await harness.setContents([
                'First paragraph\n\nSecond paragraph\n\nThird paragraph',
            ]);
            expect(runCalls).toBe(5);
            await harness.setContents([
                'First paragraph\n\nSecond paragraph\n\nThird paragraph extended',
            ]);
            expect(runCalls).toBe(6);
        } finally {
            harness.app.unmount();
        }
    });

    it('fully bypasses reuse when a custom plugin is present', async () => {
        const harness = mountInstances([bypassSpec()]);
        runCalls = 0;
        try {
            const prefix = stableParagraphs(5);
            await harness.setContents([`${prefix}\n\nactive paragraph`]);
            const afterSetup = runCalls;
            await harness.setContents([
                `${prefix}\n\nactive paragraph extended`,
            ]);
            expect(runCalls - afterSetup).toBe(11);
        } finally {
            harness.app.unmount();
        }
    });

    it('keeps bypassing after installed plugin props are replaced', async () => {
        let pluginRuns = 0;
        const countingPlugin: Plugin = () => () => {
            pluginRuns += 1;
        };
        const plugins = ref<any[]>([countingPlugin]);
        const harness = mountInstances([
            cachedSpec(() => ({ remarkPlugins: plugins.value })),
        ]);
        try {
            const content = stableParagraphs(3) + '\n\nActive paragraph';
            await harness.setContents([content]);
            plugins.value = [];
            await nextTick();
            const beforeAppend = pluginRuns;
            await harness.setContents([content + ' extended']);
            expect(pluginRuns - beforeAppend).toBeGreaterThan(1);
        } finally {
            harness.app.unmount();
        }
    });

    it('stores eligible records parsed during a nonempty initial mount', async () => {
        const content = stableParagraphs(5) + '\n\nActive paragraph';
        runCalls = 0;
        const harness = mountInstances([
            { ...cachedSpec(), initialContent: content },
        ]);
        try {
            const afterMount = runCalls;
            await harness.setContents([content + ' extended']);
            expect(runCalls - afterMount).toBe(1);
        } finally {
            harness.app.unmount();
        }
    });

    it('stores eligible records after an edit invalidates reuse', async () => {
        const initial = stableParagraphs(5) + '\n\nActive paragraph';
        const edited = initial.replace(
            'Stable paragraph 0',
            'Edited paragraph 0'
        );
        const harness = mountInstances([cachedSpec()]);
        try {
            await harness.setContents([initial]);
            await harness.setContents([edited]);
            const afterEdit = runCalls;
            await harness.setContents([edited + ' extended']);
            expect(runCalls - afterEdit).toBe(1);
        } finally {
            harness.app.unmount();
        }
    });

    it('clears cached state on truncation so removed content does not survive', async () => {
        const harness = mountInstances([cachedSpec()]);
        try {
            await harness.setContents([
                'Kept paragraph.\n\nRemoved paragraph.\n\nTail paragraph.',
            ]);
            expect(serialize(harness.instances()[0]!)).toContain(
                'Removed paragraph.'
            );
            await harness.setContents([
                'Kept paragraph.\n\nTail paragraph.',
            ]);
            expect(serialize(harness.instances()[0]!)).not.toContain(
                'Removed paragraph.'
            );
        } finally {
            harness.app.unmount();
        }
    });
});
