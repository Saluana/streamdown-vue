import { expect, test } from 'bun:test';
import { parseMarkdownIntoBlocks } from '../src/parse-blocks';
import { parseIncompleteMarkdown } from '../src/parse-incomplete-markdown';

test('parseMarkdownIntoBlocks splits markdown into blocks', () => {
  const md = '# Title\n\nParagraph one.\n\n- item1\n- item2';
  const blocks = parseMarkdownIntoBlocks(md);
  expect(blocks.length).toBeGreaterThan(1);
});

test('parseIncompleteMarkdown closes unclosed bold', () => {
  const md = '**bold';
  expect(parseIncompleteMarkdown(md)).toBe('**bold**');
});

test('single dollar sign is left alone', () => {
  const md = 'Cost is $5';
  expect(parseIncompleteMarkdown(md)).toBe('Cost is $5');
});
