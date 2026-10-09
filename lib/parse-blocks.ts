import { Lexer, Tokenizer } from 'marked';

// On JavaScriptCore (Safari, Bun) these marked rules take time proportional to
// the remaining input even when they fail at its first character, which made
// block splitting quadratic. Each guard is a necessary condition of its rule,
// so the tokens are unchanged.
const charAfterIndent = (src: string, from = 0): string | undefined => {
    let index = from;
    while (index < from + 3 && src[index] === ' ') index++;
    return src[index];
};
const setextUnderline = /^ {0,3}(?:=+|-+) *$/;
const whitespaceLine = /^\s*$/;
// Lines that end setext heading text in marked's lheading rule.
const setextInterrupt =
    /^(?: {0,3}(?:[*+-]|\d{1,9}[.)]) |(?: {4}| {0,3}\t)| {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}<[^\n>]+>$| {0,3}\|?(?:[:\- ]*\|)+[:\- ]*$)/;

class GuardedTokenizer extends Tokenizer {
    override hr(src: string) {
        const char = charAfterIndent(src);
        return char === '-' || char === '_' || char === '*'
            ? super.hr(src)
            : undefined;
    }
    override blockquote(src: string) {
        return charAfterIndent(src) === '>' ? super.blockquote(src) : undefined;
    }
    override html(src: string) {
        return charAfterIndent(src) === '<' ? super.html(src) : undefined;
    }
    // The delimiter row follows the header line.
    override table(src: string) {
        const lineEnd = src.indexOf('\n');
        const char = lineEnd === -1 ? undefined : charAfterIndent(src, lineEnd + 1);
        return char === '|' || char === ':' || char === '-'
            ? super.table(src)
            : undefined;
    }
    // The underline must directly follow the heading text, which stops at a
    // blank line or an interrupting line, so the scan never outruns the rule.
    override lheading(src: string) {
        let start = src.indexOf('\n') + 1;
        while (start > 0) {
            const end = src.indexOf('\n', start);
            const line = src.slice(start, end === -1 ? undefined : end);
            if (setextUnderline.test(line)) return super.lheading(src);
            if (whitespaceLine.test(line) || setextInterrupt.test(line)) {
                return undefined;
            }
            start = end + 1;
        }
        return undefined;
    }
}

// Exposed utility that splits markdown into logical blocks while
// keeping streaming math segments together.
export const parseBlocks = (markdown: string): string[] => {
    // Only top-level block boundaries are needed, so skip inline tokenizing.
    // A private lexer also keeps global marked configuration out of splitting.
    const tokens = new Lexer({
        gfm: true,
        tokenizer: new GuardedTokenizer(),
    }).blockTokens(markdown.replace(/\r\n|\r/g, '\n'));
    const blocks = tokens.map((token) => token.raw);

    // Post-process to merge consecutive blocks that are part of the same math block
    const mergedBlocks: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
        const currentBlock = blocks[i];
        if (typeof currentBlock !== 'string') continue;

        // Check if this is a standalone $$ that might be a closing delimiter
        if (currentBlock.trim() === '$$' && mergedBlocks.length > 0) {
            const previousBlock = mergedBlocks[mergedBlocks.length - 1];
            if (previousBlock === undefined) {
                mergedBlocks.push(currentBlock);
                continue;
            }

            // Check if the previous block starts with $$ but doesn't end with $$
            const prevStartsWith$$ = previousBlock.trimStart().startsWith('$$');
            const prevDollarCount = (previousBlock.match(/\$\$/g) || []).length;

            // If previous block has odd number of $$ and starts with $$, merge them
            if (prevStartsWith$$ && prevDollarCount % 2 === 1) {
                mergedBlocks[mergedBlocks.length - 1] =
                    previousBlock + currentBlock;
                continue;
            }
        }

        // Check if current block ends with $$ and previous block started with $$ but didn't close
        if (mergedBlocks.length > 0 && currentBlock.trimEnd().endsWith('$$')) {
            const previousBlock = mergedBlocks[mergedBlocks.length - 1];
            if (previousBlock === undefined) {
                mergedBlocks.push(currentBlock);
                continue;
            }
            const prevStartsWith$$ = previousBlock.trimStart().startsWith('$$');
            const prevDollarCount = (previousBlock.match(/\$\$/g) || []).length;
            const currDollarCount = (currentBlock.match(/\$\$/g) || []).length;

            // If previous block has unclosed math (odd $$) and current block ends with $$
            // AND current block doesn't start with $$, it's likely a continuation
            if (
                prevStartsWith$$ &&
                prevDollarCount % 2 === 1 &&
                !currentBlock.trimStart().startsWith('$$') &&
                currDollarCount === 1
            ) {
                mergedBlocks[mergedBlocks.length - 1] =
                    previousBlock + currentBlock;
                continue;
            }
        }

        mergedBlocks.push(currentBlock);
    }

    return mergedBlocks;
};
