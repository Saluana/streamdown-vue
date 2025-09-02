import { expect, test } from 'bun:test';
import { parseMarkdownIntoBlocks } from '../src/parse-blocks';
import { fixIncompleteMarkdown } from '../src/fix-incomplete-markdown';

test('parseMarkdownIntoBlocks splits markdown into blocks', () => {
  const md = '# Title\n\nParagraph one.\n\n- item1\n- item2';
  const blocks = parseMarkdownIntoBlocks(md);
  expect(blocks.length).toBeGreaterThan(1);
});

test('fixIncompleteMarkdown closes unclosed bold', () => {
  const md = '**bold';
  expect(fixIncompleteMarkdown(md)).toBe('**bold**');
});
