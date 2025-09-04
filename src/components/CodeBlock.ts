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

        // SSR fallback: immediately render plain <pre><code> so code is visible before hydration.
        if (typeof window === 'undefined') {
            const esc = (s: string) =>
                s
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            const langClass = props.language
                ? ` class=\"language-${props.language}\"`
                : '';
            html.value = `<pre${langClass}><code${langClass}>${esc(
                props.code
            )}</code></pre>`;
        }

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
        return () => {
            // Outer container ensures padding does not cause absolute buttons to clip
            return h(
                'div',
                {
                    class: 'group rounded-md border bg-gray-50 dark:bg-gray-800 overflow-hidden',
                    'data-streamdown': 'code-block',
                },
                [
                    // Header bar (language + copy) always visible; stable height avoids layout shift
                    h(
                        'div',
                        {
                            class: 'flex items-center justify-between text-xs px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 gap-2',
                            'data-streamdown': 'code-block-header',
                        },
                        [
                            props.language
                                ? h(
                                      'span',
                                      {
                                          class: 'px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px] leading-none tracking-wide',
                                          'data-streamdown': 'code-lang',
                                      },
                                      props.language
                                  )
                                : h('span', {
                                      class: 'h-4',
                                      'data-streamdown': 'code-lang-empty',
                                  }),
                            h(CopyButton, {
                                text: props.code,
                                floating: false,
                                'data-streamdown': 'copy-button',
                            }),
                        ]
                    ),
                    // Code body
                    h('div', {
                        innerHTML: html.value,
                        class: 'px-4 py-3 overflow-x-auto',
                        'data-streamdown': 'code-body',
                    }),
                ]
            );
        };
    },
});
