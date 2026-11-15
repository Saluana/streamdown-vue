import {
    defineComponent,
    h,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue';
import CopyButton from './CopyButton';

let initialized = false;
let nextId = 0;

// Retain finished diagrams across virtual-row unmounts without retaining chats
// indefinitely. Each mount gets a fresh namespace for SVG ids and references.
const cache = new Map<string, string>();
const MAX_CACHED_DIAGRAMS = 32;
const scopeSvg = (source: string, prefix: string): string => {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    const ids = new Map<string, string>();
    document.querySelectorAll('[id]').forEach((node, index) => {
        const id = `${prefix}-${index}`;
        ids.set(node.id, id);
        node.id = id;
    });
    const pattern = [...ids.keys()]
        .sort((a, b) => b.length - a.length)
        .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    const references = new RegExp(`#(${pattern})(?![\\w-])`, 'g');
    const replace = (value: string) =>
        value.replace(references, (_match, id: string) => `#${ids.get(id)}`);
    document.querySelectorAll('*').forEach((node) => {
        for (const attribute of [...node.attributes]) {
            const value =
                attribute.name === 'aria-labelledby' ||
                attribute.name === 'aria-describedby'
                    ? attribute.value
                          .split(/\s+/)
                          .map((id) => ids.get(id) ?? id)
                          .join(' ')
                    : replace(attribute.value);
            if (value !== attribute.value)
                node.setAttribute(attribute.name, value);
        }
        if (node.tagName === 'style')
            node.textContent = replace(node.textContent ?? '');
    });
    return new XMLSerializer().serializeToString(document.documentElement);
};

export default defineComponent({
    name: 'MermaidBlock',
    props: {
        code: { type: String, required: true },
        streaming: { type: Boolean, default: false },
    },
    setup(props) {
        const svg = ref('');
        const viewId = `streamdown-mermaid-view-${++nextId}`;
        const error = ref('');
        let revision = 0;
        let disposed = false;

        const render = async () => {
            const token = ++revision;
            if (props.streaming) {
                svg.value = '';
                error.value = '';
                return;
            }
            const code = props.code;
            const cached = cache.get(code);
            if (cached) {
                svg.value = scopeSvg(cached, viewId);
                error.value = '';
                return;
            }
            try {
                const mermaid = (await import('mermaid')).default;
                if (disposed || token !== revision) return;
                if (!initialized) {
                    mermaid.initialize({ startOnLoad: false });
                    initialized = true;
                }
                const { svg: output } = await mermaid.render(
                    `streamdown-mermaid-${++nextId}`,
                    code
                );
                cache.delete(code);
                cache.set(code, output);
                if (cache.size > MAX_CACHED_DIAGRAMS)
                    cache.delete(cache.keys().next().value!);
                if (disposed || token !== revision) return;
                svg.value = scopeSvg(output, viewId);
                error.value = '';
            } catch (cause: unknown) {
                if (disposed || token !== revision) return;
                error.value =
                    cause instanceof Error
                        ? cause.message
                        : 'Failed to render mermaid diagram';
            }
        };

        onMounted(() => {
            watch(() => [props.code, props.streaming], render, {
                immediate: true,
            });
        });
        onBeforeUnmount(() => {
            disposed = true;
            revision++;
        });

        return () =>
            h(
                'div',
                { class: 'relative group', 'data-streamdown': 'mermaid' },
                [
                    // Keep the source (or last successful SVG) until rendering finishes.
                    // A spinner would collapse the row between the fence and its SVG.
                    svg.value
                        ? h('div', { innerHTML: svg.value })
                        : h('pre', { 'data-streamdown': 'pre' }, [
                              h('code', props.code),
                          ]),
                    error.value
                        ? h(
                              'div',
                              {
                                  class: 'text-red-500 text-sm mt-2',
                                  role: 'status',
                              },
                              error.value
                          )
                        : null,
                    h(CopyButton, {
                        text: props.code,
                        'data-streamdown': 'copy-button',
                    }),
                ]
            );
    },
});
