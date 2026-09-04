import { describe, it, expect } from 'bun:test';
import { parseIncompleteMarkdown } from '../lib/parse-incomplete-markdown';

// Delimiters inside inline code spans or fenced code blocks are not emphasis
// syntax, so they must not make the auto-close logic append a stray marker.
describe('delimiters inside code are not emphasis', () => {
    it('leaves a double underscore inside an inline code span alone', () => {
        const input = 'Prefix a name with `__` to make it private.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('leaves a double asterisk inside an inline code span alone', () => {
        const input = 'Use the `**` glob to match every directory.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('leaves a glob inside an inline code span alone', () => {
        const input = 'Ignore anything under `**/*.py`.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('does not append a marker after a closing fence', () => {
        const input = 'Fenced code:\n\n```python\nx = 1  # a __private var\n```\n';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('ignores a single underscore inside an inline code span', () => {
        const input = 'Call `foo_bar` when ready.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('ignores strikethrough tildes inside an inline code span', () => {
        const input = 'The `~~` operator is unusual.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('ignores block math delimiters inside an inline code span', () => {
        const input = 'Write `$$` to open display math.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('still closes emphasis that opens outside of code', () => {
        expect(parseIncompleteMarkdown('Run `npm ci` then **go')).toBe(
            'Run `npm ci` then **go**'
        );
        expect(parseIncompleteMarkdown('Glob `**/*.ts` and **bold')).toBe(
            'Glob `**/*.ts` and **bold**'
        );
    });

    it('still closes emphasis that follows a complete fenced block', () => {
        expect(parseIncompleteMarkdown('```\nx = 1\n```\n\nNow **bold')).toBe(
            '```\nx = 1\n```\n\nNow **bold**'
        );
    });

    it('does not close emphasis started inside an unterminated fence', () => {
        const input = '```python\nx = 1  # a __private var';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('does not close emphasis started inside an unterminated code span', () => {
        const input = 'Prefix a name with `__';
        expect(parseIncompleteMarkdown(input)).toBe('Prefix a name with `__`');
    });
});
