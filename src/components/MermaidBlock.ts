import { defineComponent, h, onMounted, ref } from 'vue';
import CopyButton from './CopyButton';

let initialized = false;
const cache: Record<string, string> = {};
const hash = (str: string): string => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h).toString(36);
};

export default defineComponent({
    name: 'MermaidBlock',
    props: {
        code: { type: String, required: true },
    },
    setup(props) {
        const svg = ref('');
        const lastGood = ref('');
        const error = ref('');
        const loading = ref(true);
        const id = `streamdown-vue-mermaid-${hash(props.code)}`;

        const render = async () => {
            loading.value = true;
            try {
                const mermaid = (await import('mermaid')).default;
                if (!initialized) {
                    mermaid.initialize({ startOnLoad: false });
                    initialized = true;
                }
                if (cache[id]) {
                    svg.value = cache[id];
                    loading.value = false;
                    return;
                }
                const { svg: out } = await mermaid.render(id, props.code);
                svg.value = out;
                lastGood.value = out;
                cache[id] = out;
                error.value = '';
            } catch (e: any) {
                error.value = e.message || 'Failed to render mermaid diagram';
                svg.value = lastGood.value;
            } finally {
                loading.value = false;
            }
        };

        onMounted(render);

        return () =>
            h(
                'div',
                { class: 'relative group', 'data-streamdown': 'mermaid' },
                [
                    loading.value
                        ? h('div', { class: 'flex justify-center py-8' }, [
                              h('div', {
                                  class: 'h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin',
                              }),
                          ])
                        : svg.value
                        ? h('div', { innerHTML: svg.value })
                        : h(
                              'div',
                              { class: 'text-red-500 text-sm' },
                              error.value
                          ),
                    !loading.value && error.value && svg.value
                        ? h(
                              'div',
                              { class: 'text-red-500 text-sm mt-2' },
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
