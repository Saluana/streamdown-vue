import { defineComponent, h, inject } from 'vue';
import { Download } from 'lucide-vue-next';
import { CODE_BLOCK_META_KEY } from './codeblock-context';

// Basic language->extension mapping (subset; users can override by wrapping component)
const EXT_MAP: Record<string, string> = {
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    json: 'json',
    vue: 'vue',
    html: 'html',
    css: 'css',
    md: 'md',
    markdown: 'md',
    sh: 'sh',
    bash: 'sh',
    py: 'py',
    python: 'py',
    go: 'go',
    rust: 'rs',
    rs: 'rs',
};

export default defineComponent({
    name: 'DownloadButton',
    props: {
        text: { type: String, required: false }, // optional override
        filename: { type: String, required: false },
        floating: { type: Boolean, default: true },
    },
    setup(props) {
        const meta = inject(CODE_BLOCK_META_KEY, { code: '', language: '' });
        const download = () => {
            const code = props.text ?? meta.code;
            if (!code) return;
            const ext =
                (meta.language && EXT_MAP[meta.language.toLowerCase()]) ||
                'txt';
            const name = props.filename || `file.${ext}`;
            try {
                const blob = new Blob([code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch {
                // ignore failures silently
            }
        };
        return () =>
            h(
                'button',
                {
                    class: [
                        props.floating
                            ? 'absolute top-2 right-9 opacity-0 group-hover:opacity-100'
                            : 'opacity-80 hover:opacity-100',
                        'p-1 rounded bg-gray-200 dark:bg-gray-700 transition-opacity flex items-center justify-center',
                    ].join(' '),
                    onClick: download,
                    'aria-live': 'polite',
                    title: 'Download code',
                },
                [
                    h(Download, { class: 'h-4 w-4' }),
                    h('span', { class: 'sr-only' }, 'Download'),
                ]
            );
    },
});
