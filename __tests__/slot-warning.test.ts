import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

describe('StreamMarkdown slot wrapping', () => {
    it('renders simple content without throwing', async () => {
        const app = h(StreamMarkdown, { content: 'Hello **world**' });
        const html = await renderToString(app);
        expect(html).toContain('Hello');
    });
});
