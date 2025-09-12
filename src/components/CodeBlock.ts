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
import DownloadButton from './DownloadButton';
import { useShikiHighlighter } from '../use-shiki-highlighter';
import {
    CODE_BLOCK_META_KEY,
    GLOBAL_CODE_BLOCK_ACTIONS,
    type CodeBlockAction,
} from './codeblock-context';
import { provide, inject } from 'vue';

export default defineComponent({
    name: 'CodeBlock',
    props: {
        code: { type: String, required: true },
        language: { type: String, default: '' },
        theme: { type: String, default: 'github-light' },
        showLineNumbers: { type: Boolean, default: false },
        selectable: { type: Boolean, default: true },
        // Array of extra action components (or render functions) appended to header right side.
        actions: { type: Array as () => CodeBlockAction[], default: () => [] },
        // Hide built-in copy or download buttons if user wants total control.
        hideCopy: { type: Boolean, default: false },
        hideDownload: { type: Boolean, default: false },
    },
    setup(props, { attrs, slots }) {
        const html = ref('');
        // Provide code & language for nested buttons
        provide(CODE_BLOCK_META_KEY, {
            get code() {
                return props.code;
            },
            get language() {
                return props.language;
            },
        } as any);
        const globalActions = inject(GLOBAL_CODE_BLOCK_ACTIONS, [] as any[]);
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
                ? `language-${props.language}`
                : '';
            const basePreClasses = [langClass];
            if (!props.selectable) basePreClasses.push('select-none');
            let codeInner: string;
            if (props.showLineNumbers) {
                const lines = props.code.split(/\r?\n/);
                codeInner = lines
                    .map(
                        (ln, i) =>
                            `<span class="line"><span class="code-line-number select-none opacity-60 pr-4 text-xs" data-line-number data-streamdown="code-line-number">${
                                i + 1
                            }</span>${esc(ln)}</span>`
                    )
                    .join('\n');
            } else {
                codeInner = esc(props.code);
            }
            const preClassAttr = basePreClasses.filter(Boolean).length
                ? ` class="${basePreClasses.join(' ')}"`
                : '';
            const codeClassAttr = langClass ? ` class="${langClass}"` : '';
            html.value = `<pre${preClassAttr}><code${codeClassAttr}>${codeInner}</code></pre>`;
        }

        const stripPreBackground = (s: string): string => {
            // remove inline background declarations from <pre style="..."> attributes
            return s.replace(
                /(<pre[^>]*style=")([^"]*)("[^>]*>)/g,
                (m, p1, style, p3) => {
                    const cleaned = style
                        .split(/;\s*/)
                        .filter(
                            (decl: string) =>
                                decl &&
                                !/background(-color)?\s*:/.test(
                                    decl.toLowerCase()
                                )
                        )
                        .join('; ');
                    return `${p1}${cleaned}${p3}`.replace(/style=""/, '');
                }
            );
        };

        const addLineNumbers = (s: string): string => {
            if (!props.showLineNumbers) return s;
            // naive approach: find each <span class="line"> occurrence
            let lineNo = 0;
            return s.replace(/<span class="line(.*?)">/g, (match, rest) => {
                lineNo += 1;
                return `<span class="line${rest}"><span class="code-line-number select-none opacity-60 pr-4 text-xs" data-line-number data-streamdown="code-line-number">${lineNo}</span>`;
            });
        };

        const ensureSelectable = (s: string): string => {
            if (props.selectable) return s;
            return s.replace('<pre', '<pre class="select-none"');
        };

        const processOutput = (raw: string): string => {
            return ensureSelectable(addLineNumbers(stripPreBackground(raw)));
        };

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
                    html.value = processOutput(out);
                }
            } catch {
                if (currentToken === renderToken) {
                    html.value = processOutput(
                        `<pre><code>${props.code}</code></pre>`
                    );
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
                            h(
                                'div',
                                {
                                    class: 'flex items-center gap-1',
                                    'data-streamdown': 'code-actions',
                                },
                                [
                                    // user supplied actions (prop)
                                    ...props.actions.map((A: any, idx) =>
                                        h(A, {
                                            key: idx,
                                            code: props.code,
                                            language: props.language,
                                        })
                                    ),
                                    // global injected actions
                                    ...globalActions.map((A: any, idx) =>
                                        h(A, {
                                            key: `g-${idx}`,
                                            code: props.code,
                                            language: props.language,
                                        })
                                    ),
                                    // slot based actions (<template #actions>)
                                    ...(slots.actions ? slots.actions() : []),
                                    !props.hideDownload
                                        ? h(DownloadButton, {
                                              floating: false,
                                              'data-streamdown':
                                                  'download-button',
                                          })
                                        : null,
                                    !props.hideCopy
                                        ? h(CopyButton, {
                                              floating: false,
                                              'data-streamdown': 'copy-button',
                                          })
                                        : null,
                                ].filter(Boolean)
                            ),
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
