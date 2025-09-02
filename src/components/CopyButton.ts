import { defineComponent, h, ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';

export default defineComponent({
  name: 'CopyButton',
  props: {
    text: { type: String, required: true },
  },
  setup(props) {
    const copied = ref(false);
    const copy = async () => {
      try {
        await navigator.clipboard?.writeText(props.text);
        copied.value = true;
        setTimeout(() => {
          copied.value = false;
        }, 2000);
      } catch {
        // ignore copy errors
      }
    };
    return () =>
      h(
        'button',
        {
          class:
            'absolute top-2 right-2 p-1 rounded bg-gray-200 dark:bg-gray-700 opacity-0 group-hover:opacity-100',
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
