import { defineComponent, h, onMounted, onBeforeUnmount, ref } from 'vue';
import CopyButton from './CopyButton';
import { useShikiHighlighter } from '../use-shiki-highlighter';

export default defineComponent({
    name: 'CodeBlock',
    props: {
        code: { type: String, required: true },
        language: { type: String, default: '' },
        theme: { type: String, default: 'github-light' },
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
                    const theme =
                        props.theme ||
                        (media!.matches ? 'github-dark' : 'github-light');
                    let lang = props.language || 'txt';
                    try {
                        html.value = highlighter.codeToHtml(props.code, {
                            lang,
                            theme,
                        });
                    } catch (e) {
                        // Attempt dynamic language load (Shiki v3 supports on-demand add).
                        try {
                            // Avoid throwing if lang already registered under an alias.
                            if (
                                !highlighter.getLoadedLanguages().includes(lang)
                            ) {
                                await highlighter.loadLanguage(lang as any);
                            }
                            html.value = highlighter.codeToHtml(props.code, {
                                lang,
                                theme,
                            });
                        } catch (err) {
                            // Final fallback: plain pre/code.
                            console.debug(
                                '[streamdown-vue] highlight fallback',
                                {
                                    lang,
                                    err,
                                }
                            );
                            html.value = `<pre><code>${props.code}</code></pre>`;
                        }
                    }
                } catch {
                    html.value = `<pre><code>${props.code}</code></pre>`;
                }
            };
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
