import { createSSRApp, nextTick } from 'vue';
import { StreamMarkdown } from '../../index';

const hydrationWarnings: string[] = [];
const app = createSSRApp(StreamMarkdown, { content: '# Hydration check' });
app.config.warnHandler = (message) => {
    if (/hydrat/i.test(message)) hydrationWarnings.push(message);
};
app.mount('#app');

await nextTick();
const status = document.querySelector<HTMLOutputElement>('#hydration-status');
if (!status) throw new Error('Missing hydration status output');
status.dataset.status = hydrationWarnings.length ? 'failed' : 'passed';
status.textContent = hydrationWarnings.length
    ? hydrationWarnings.join('\n')
    : 'Hydration passed';
