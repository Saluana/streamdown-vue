import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Marked } from 'marked';
import { parseBlocks } from '../lib/parse-blocks';
import { parseIncompleteMarkdown } from '../lib/parse-incomplete-markdown';

test('parseBlocks splits markdown into blocks', () => {
  const md = '# Title\n\nParagraph one.\n\n- item1\n- item2';
  const blocks = parseBlocks(md);
  expect(blocks.length).toBeGreaterThan(1);
});

test('single dollar sign is left alone', () => {
  const md = 'Cost is $5';
  expect(parseIncompleteMarkdown(md)).toBe('Cost is $5');
});

// Block constructs whose marked rules are guarded in parseBlocks.
const blockEdgeCases = [
  'Setext title', '===', '', 'Sub title', '---', '', 'Paragraph', 'continues here.', '',
  '| a | b |', '| --- | :-: |', '| 1 | 2 |', '', 'a | b', '-- | --', '',
  'Not a table', '|x|', '',
  '<div>', 'html block', '</div>', '', '<!-- comment', '', 'spans blank lines -->', '',
  '<script>', 'let a = 1;', '', 'let b = 2;', '</script>', '',
  '<not-html is text', '',
  '---', '', ' * * *', '', '___', '', '- - -', '',
  '> quote', 'lazy continuation', '> > nested', '', '   > indented quote', '',
  '- tight', '- list', '', '1. loose', '', '2. list', '   - nested', '',
  '```js', 'const x = `tick`;', '```', '', '~~~', '- not a list', '~~~', '',
  '    indented code', '', '    more code', '',
  '[ref]: https://example.com', '', 'Text with <span>inline html</span> and a=b', '',
  'Paragraph then', '- interrupting list', '', 'Title  ', '  ---  ', '',
  'Before heading', '# Heading', '===', '', 'Before quote', '> quote', '---', '',
  'Before item', '- item', '===', '', 'Before fence', '```', 'x', '```', '===', '',
  'Before tag', '<div>', '===', '', 'Before row', '| a |', '---', '',
  'Before indent', '    indented', '===', '', 'Before rule', '***', 'Title', '===', '',
  'Trailing paragraph with no newline',
].join('\n');

test('parseBlocks keeps marked block boundaries', () => {
  const reference = new Marked({ gfm: true });
  for (const md of [
    blockEdgeCases,
    blockEdgeCases.replace(/\n/g, '\r\n'),
    readFileSync('__tests__/fixtures/complex-code.md', 'utf8'),
  ]) {
    expect(parseBlocks(md)).toEqual(reference.lexer(md).map((token) => token.raw));
  }
});

test('parseBlocks stays linear on long documents', () => {
  parseBlocks('warm up\n\n');
  for (const [md, blocks] of [
    ['Paragraph text that is ordinary.\n\n'.repeat(2000), 4000],
    ['Paragraph\n# Heading\n'.repeat(4000), 8000],
  ] as const) {
    const start = performance.now();
    expect(parseBlocks(md)).toHaveLength(blocks);
    expect(performance.now() - start).toBeLessThan(250);
  }
});

test('parseIncompleteMarkdown stays linear on long documents', () => {
  parseIncompleteMarkdown('warm `up` my_var');
  for (const md of [
    'Use `snake_case` like my_var, __init__, `code`, _emphasis_ and $$x_1$$.\n\n'.repeat(400),
    'a * b '.repeat(7000),
  ]) {
    const start = performance.now();
    expect(parseIncompleteMarkdown(md)).toBe(md);
    expect(performance.now() - start).toBeLessThan(40);
  }
});
