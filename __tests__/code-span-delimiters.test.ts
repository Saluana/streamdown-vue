import { describe, it, expect } from 'bun:test';
import {
    closeOpenInlineCode,
    parseIncompleteMarkdown,
} from '../lib/parse-incomplete-markdown';

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

    it('leaves a double-backtick span holding a single backtick alone', () => {
        const input = 'Literal `` \\[double`tick\\] `` stays code.';
        expect(parseIncompleteMarkdown(input)).toBe(input);
    });

    it('closes a dangling single-backtick span after a double-backtick span', () => {
        const input = 'See `` a`b `` then `\\[c\\]';
        expect(parseIncompleteMarkdown(input)).toBe(`${input}\``);
    });

    it('closes a single-backtick span after an unmatched double run', () => {
        for (const input of [
            "``quote''\n\nThen `value",
            "``quote'' then `value",
        ]) {
            expect(parseIncompleteMarkdown(input)).toBe(`${input}\``);
        }
    });

    it('does not reach back across a blank line to close a span', () => {
        expect(closeOpenInlineCode('A `literal\n\nNext paragraph')).toBe(
            'A `literal\n\nNext paragraph'
        );
    });

    it('skips fenced blocks when closing an inline span', () => {
        expect(closeOpenInlineCode('```\ncode\n````\n\nThen `value')).toBe(
            '```\ncode\n````\n\nThen `value`'
        );
        expect(closeOpenInlineCode('~~~\n``\n~~~\nThen `value')).toBe(
            '~~~\n``\n~~~\nThen `value`'
        );
        expect(closeOpenInlineCode('```js\nconst a = `b')).toBe(
            '```js\nconst a = `b'
        );
    });

    it('does not truncate brackets inside code as incomplete links', () => {
        for (const input of [
            'Use `array[0` here.',
            'Text\n\n```js\nconst a = arr[\n```\n\nDone.',
        ]) {
            expect(parseIncompleteMarkdown(input)).toBe(input);
        }
        expect(parseIncompleteMarkdown('See `code` and [partial')).toBe(
            'See `code` and '
        );
    });
});
