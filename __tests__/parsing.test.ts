import { describe, expect, it } from 'bun:test';
import { parseBlocks, parseIncompleteMarkdown } from '..';

describe('parsing utilities', () => {
  it('repairs markdown cut off mid-bold', () => {
    const input = 'This is **bol';
    const output = parseIncompleteMarkdown(input);
    expect(output).toBe('This is **bol**');
  });

  it('handles incomplete list items without throwing', () => {
    const input = '- item\n- ite';
    const output = parseIncompleteMarkdown(input);
    expect(output).toBe(input);
    const blocks = parseBlocks(output);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toBe(input);
  });
});
