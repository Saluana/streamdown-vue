import { describe, it, expect } from 'bun:test';
import { parseIncompleteMarkdown } from '../lib/parse-incomplete-markdown';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// Utility to count occurrences
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('incomplete streaming / markdown scenarios', () => {
    it('1. progressive second code fence shows partial code without duplication', async () => {
        const step1 = '```js\nconsole.log(1);\n```\n\n';
        const step2 = step1 + '```ts\nexport function foo() {\n';
        const step3 = step2 + '  return 42;\n';
        const step4 = step3 + '}\n'; // still open (no closing fence)

        const html1 = await renderToString(
            h(StreamMarkdown, { content: step1 })
        );
        expect(count(html1, 'console.log(1);')).toBe(1);
        expect(html1).not.toMatch(/return 42/);

        const html2 = await renderToString(
            h(StreamMarkdown, { content: step2 })
        );
        expect(count(html2, 'console.log(1);')).toBe(1);
        expect(html2).toContain('export function foo');
        const html3 = await renderToString(
            h(StreamMarkdown, { content: step3 })
        );
        expect(count(html3, 'return 42;')).toBe(1);
        const html4 = await renderToString(
            h(StreamMarkdown, { content: step4 })
        );
        // Still only one occurrence of each fragment
        expect(count(html4, 'export function foo')).toBe(1);
        expect(count(html4, 'return 42;')).toBe(1);
    });

    it('2. complex mixed inline unfinished tokens become balanced while incomplete link removed', () => {
        const src =
            'Line with *italic start and **bold start plus `code start and an unmatched link [Example';
        const out = parseIncompleteMarkdown(src);
        // Incomplete link should be stripped (no trailing [Example)
        expect(out).not.toMatch(/\[Example/);
        // Italic single * closed
        expect(count(out, '*')).toBeGreaterThanOrEqual(4); // *italic* + **bold** adds at least 4 asterisks
        // Backtick closed
        expect(count(out, '`')).toBe(2);
    });

    it('3. incomplete matrix environment inside $$ is left open (no auto close $$)', () => {
        const src = '$$\\begin{matrix}1 & 2\\\\ 3 & 4';
        const out = parseIncompleteMarkdown(src);
        // Should not add closing $$ because environment not ended
        expect(out).toBe(src);
        expect(count(out, '$$')).toBe(1);
    });

    it('4. incomplete block math without environment gets closed', () => {
        const src = '$$a = b + c';
        const out = parseIncompleteMarkdown(src);
        expect(out).toMatch(/\$\$a = b \+ c\$\$/);
        expect(count(out, '$$')).toBe(2); // one opening, one closing
    });

    it('5. single asterisk italic auto-closes', () => {
        const src = 'This is *partial';
        const out = parseIncompleteMarkdown(src);
        expect(out.endsWith('*')).toBe(true);
        expect(count(out, '*') % 2).toBe(0); // balanced single asterisks
    });

    it('6. underscores inside math ignored; trailing underscore italic outside math auto-closes', () => {
        const src = '$$a_b + c_d$$ and _italic';
        const out = parseIncompleteMarkdown(src);
        // Should close trailing underscore
        expect(out.endsWith('_')).toBe(true);
        // Ensure math part unchanged
        expect(out.startsWith('$$a_b + c_d$$')).toBe(true);
    });

    it('7. unmatched backtick inline code closed', () => {
        const src = 'Start `code part';
        const out = parseIncompleteMarkdown(src);
        expect(count(out, '`')).toBe(2);
        expect(out).toContain('`code part`');
    });

    it('8. unmatched strikethrough closes', () => {
        const src = 'This is ~~strike start';
        const out = parseIncompleteMarkdown(src);
        expect(count(out, '~~') % 2).toBe(0); // balanced pairs
        expect(out).toContain('~~strike start~~');
    });
});
