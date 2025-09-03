import { defineComponent, h, onMounted, onBeforeUnmount, ref } from 'vue';
import CopyButton from './CopyButton';
import { useShikiHighlighter } from '../use-shiki-highlighter';

export default defineComponent({
    name: 'CodeBlock',
    props: {
        code: { type: String, required: true },
        language: { type: String, default: '' },
    },
    setup(props) {
        const html = ref('');
        let media: MediaQueryList | null = null;
        let render: () => Promise<void> = async () => {};

        onMounted(() => {
            media = window.matchMedia('(prefers-color-scheme: dark)');
            render = async () => {
                try {
                    const highlighter = await useShikiHighlighter();
                    const theme = media!.matches
                        ? 'github-dark'
                        : 'github-light';
                    html.value = highlighter.codeToHtml(props.code, {
                        lang: props.language || 'txt',
                        theme,
                    });
                } catch {
                    html.value = `<pre><code>${props.code}</code></pre>`;
                }
            };
            // initial render (no await so lifecycle registration remains sync)
            render();
            media.addEventListener('change', render);
        });

        onBeforeUnmount(() => {
            if (media) media.removeEventListener('change', render);
        });
        return () =>
            h(
                'div',
                {
                    class: 'relative group rounded-md border bg-gray-50 dark:bg-gray-800 p-4',
                    'data-streamdown': 'code-block',
                },
                [
                    h('div', { innerHTML: html.value }),
                    props.language
                        ? h(
                              'span',
                              {
                                  class: 'absolute top-2 left-2 text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 opacity-0 group-hover:opacity-100',
                              },
                              props.language
                          )
                        : null,
                    h(CopyButton, { text: props.code }),
                ]
            );
    },
});
