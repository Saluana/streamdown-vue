import { defineComponent, h } from 'vue';

export default defineComponent({
  name: 'CopyButton',
  props: {
    text: { type: String, required: true },
  },
  setup(props) {
    const copy = () => navigator.clipboard?.writeText(props.text);
    return () =>
      h(
        'button',
        {
          class:
            'absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 opacity-0 group-hover:opacity-100',
          onClick: copy,
        },
        'Copy'
      );
  },
});
