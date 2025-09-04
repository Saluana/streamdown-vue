import {
    defineComponent,
    h,
    onMounted,
    onBeforeUnmount,
    ref,
    watch,
    getCurrentInstance,
    nextTick,
} from 'vue';
import CopyButton from './CopyButton';
import { useShikiHighlighter } from '../use-shiki-highlighter';

export default defineComponent({
    name: 'CodeBlock',
    props: {
        code: { type: String, required: true },
        language: { type: String, default: '' },
        theme: { type: String, default: 'github-light' },
    },
    setup(props, { attrs }) {
        const html = ref('');
        let media: MediaQueryList | null = null;
        let render: () => Promise<void> = async () => {};
        // token to avoid race condition when rapid streaming updates trigger overlapping async renders
        let renderToken = 0;

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

        const doHighlight = async () => {
            const currentToken = ++renderToken;
            try {
                const highlighter = await useShikiHighlighter();
                const theme =
                    props.theme ||
                    (media?.matches ? 'github-dark' : 'github-light');
                const lang = props.language || 'txt';
                let out = '';
                try {
                    out = highlighter.codeToHtml(props.code, { lang, theme });
                } catch (e) {
                    try {
                        if (!highlighter.getLoadedLanguages().includes(lang)) {
                            // attempt dynamic load
                            // @ts-ignore
                            await highlighter.loadLanguage(lang);
                        }
                        out = highlighter.codeToHtml(props.code, {
                            lang,
                            theme,
                        });
                    } catch {
                        out = `<pre><code>${props.code}</code></pre>`;
                    }
                }
                // Only commit if this is the latest async render
                if (currentToken === renderToken) {
                    html.value = out;
                }
            } catch {
                if (currentToken === renderToken) {
                    html.value = `<pre><code>${props.code}</code></pre>`;
                }
            }
        };

        onMounted(() => {
            media = window.matchMedia('(prefers-color-scheme: dark)');
            render = doHighlight;
            render();
            media.addEventListener('change', render);
        });

        // Re-highlight when code / language / theme changes (progressive streaming updates)
        watch(
            () => [props.code, props.language, props.theme],
            () => {
                // Batch with nextTick so rapid successive parent updates collapse
                nextTick(() => render());
            }
        );

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
                    ...attrs,
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
