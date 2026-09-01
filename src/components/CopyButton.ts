import { defineComponent, h, ref, inject } from 'vue';
import { Copy, Check } from '@lucide/vue';
import { CODE_BLOCK_META_KEY } from './codeblock-context';

interface ClipboardWriter {
    writeText(text: string): Promise<void>;
}

export async function writeClipboardText(
    text: string,
    clipboard: ClipboardWriter | undefined =
        typeof navigator === 'undefined' ? undefined : navigator.clipboard
): Promise<boolean> {
    if (!text || !clipboard?.writeText) return false;
    try {
        await clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

export default defineComponent({
    name: 'CopyButton',
    props: {
        // text is optional now; will default to injected code.
        text: { type: String, required: false },
        floating: { type: Boolean, default: true },
    },
    setup(props) {
        const copied = ref(false);
        const meta = inject(CODE_BLOCK_META_KEY, { code: '', language: '' });
        const copy = async () => {
            const txt = props.text ?? meta.code;
            if (!(await writeClipboardText(txt))) return;
            copied.value = true;
            setTimeout(() => {
                copied.value = false;
            }, 2000);
        };
        return () =>
            h(
                'button',
                {
                    class: [
                        props.floating
                            ? 'absolute top-2 right-2 opacity-0 group-hover:opacity-100'
                            : 'opacity-80 hover:opacity-100',
                        'p-1 rounded bg-gray-200 dark:bg-gray-700 transition-opacity flex items-center justify-center',
                    ].join(' '),
                    onClick: copy,
                    'aria-live': 'polite',
                },
                [
                    copied.value
                        ? h(Check, { class: 'h-4 w-4' })
                        : h(Copy, { class: 'h-4 w-4' }),
                    h(
                        'span',
                        { class: 'sr-only' },
                        copied.value ? 'Copied' : 'Copy'
                    ),
                ]
            );
    },
});
