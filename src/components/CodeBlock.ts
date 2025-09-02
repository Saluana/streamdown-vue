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
      onMounted(async () => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const render = async () => {
          try {
            const highlighter = await useShikiHighlighter();
            const theme = media.matches ? 'github-dark' : 'github-light';
            html.value = highlighter.codeToHtml(props.code, {
              lang: props.language || 'txt',
              theme,
            });
          } catch {
            html.value = `<pre><code>${props.code}</code></pre>`;
          }
        };
        await render();
        media.addEventListener('change', render);
        onBeforeUnmount(() => media.removeEventListener('change', render));
      });
      return () =>
        h('div', { class: 'relative group' }, [
          h('div', { innerHTML: html.value }),
          h(CopyButton, { text: props.code }),
        ]);
    },
});
