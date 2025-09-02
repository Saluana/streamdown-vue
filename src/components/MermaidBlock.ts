import { defineComponent, h, onMounted, ref } from 'vue';
import CopyButton from './CopyButton';

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

      const render = async () => {
        loading.value = true;
        try {
          const mermaid = (await import('mermaid')).default;
          const { svg: out } = await mermaid.render(
            `vuedown-mermaid-${Math.random().toString(36).slice(2)}`,
            props.code
          );
          svg.value = out;
          lastGood.value = out;
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
        h('div', { class: 'relative group' }, [
          loading.value
            ? h('div', { class: 'flex justify-center py-8' }, [
                h('div', {
                  class:
                    'h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin',
                }),
              ])
            : svg.value
            ? h('div', { innerHTML: svg.value })
            : h('div', { class: 'text-red-500 text-sm' }, error.value),
          !loading.value && error.value && svg.value
            ? h('div', { class: 'text-red-500 text-sm mt-2' }, error.value)
            : null,
          h(CopyButton, { text: props.code }),
        ]);
    },
  });
