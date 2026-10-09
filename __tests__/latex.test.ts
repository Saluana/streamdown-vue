import { describe, expect, it } from 'bun:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import {
    fixDollarSignMath,
    fixMatrix,
    normalizeBracketDisplayMath,
    normalizeDisplayMath,
    normalizeLatexOutsideCode,
} from '../lib/latex-utils';

describe('latex utilities', () => {
    it('optional helper does not alter valid inline math', () => {
        const input = 'Euler: $e^{i\\pi}+1=0$';
        expect(fixDollarSignMath(input)).toBe(input);
    });

    it('fixes missing matrix row breaks', () => {
        const input = '\\begin{matrix}1 & 2\n3 & 4\\end{matrix}';
        const output = fixMatrix(input);
        expect(output).toContain('1 & 2 \\\\');
        expect(output).toContain('3 & 4');
    });

    it('normalizes bracket math inside blockquotes into $$ blocks', () => {
        const input = ['> 引用', '> \\[ x^2 \\]', '> 结束'].join('\n');
        const output = normalizeBracketDisplayMath(input);
        expect(output).toContain('> $$');
        expect(output).toContain('> x^2');
        expect(output).toContain('> $$\n> 结束');
        expect(output).not.toContain('\\\\[');
    });

    it('skips normalization inside indented fences', () => {
        const input = ['> ```', '> \\[raw\\]', '> ```', '', '\\[ real \\]'].join('\n');
        const output = normalizeBracketDisplayMath(input);
        expect(output).toContain('> ```');
        expect(output).toContain('> \\[raw\\]');
        expect(output).toMatch(/\$\$\s*\nreal\s*\n\$\$/);
    });

    it('keeps trailing text after single-line closures in blockquotes', () => {
        const input = '> \\[ x^2 \\] 继续';
        const output = normalizeBracketDisplayMath(input);
        expect(output).toContain('> $$');
        expect(output).toContain('> x^2');
        expect(output).toContain('> $$\n> 继续');
    });
});

// Same parser configuration StreamMarkdown uses by default.
const markdownParser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath, { singleDollarTextMath: false });
let parseCount = 0;
const normalize = (source: string) =>
    normalizeLatexOutsideCode(source, (markdown) => {
        parseCount++;
        return markdownParser.parse(markdown);
    });
const plainPipeline = (source: string) =>
    normalizeDisplayMath(normalizeBracketDisplayMath(fixMatrix(source)));

// Ways code-aware normalization can fail, one case each:
// - extra parsing for messages the normalizers cannot change;
// - output drift for documents without code;
// - placeholder collisions with the source text;
// - CRLF input shifting parser offsets;
// - math or matrices pairing across code (swallowing or rewriting it);
// - over-protecting unrelated math elsewhere in the document;
// - a repaired streaming parse reporting ranges past the source end.
describe('code-aware latex normalization', () => {
    it('does not parse messages without bracket math or matrices', () => {
        parseCount = 0;
        const input = 'Plain `code`, $$x^2$$ and \\(y\\).\r\nNext line';
        expect(normalize(input)).toBe(plainPipeline(input));
        expect(parseCount).toBe(0);
    });

    it('does not parse LaTeX that cannot contain code', () => {
        parseCount = 0;
        const input = '- Step\n  \\[ x^2 \\]\n\n$$\\begin{matrix}1 & 2\\end{matrix}$$';
        expect(normalize(input)).toBe(plainPipeline(input));
        expect(parseCount).toBe(0);
    });

    it('matches the plain pipeline when the document has no code', () => {
        const input = [
            '> \\[ x^2 \\] trailing',
            'Inline \\[ a + b \\] text.',
            '$$\\begin{matrix}1 & 2\\\\ 3 & 4\\end{matrix}$$',
            '\\[',
            '\\begin{pmatrix} a & b',
            'c & d \\end{pmatrix}',
            '\\]',
        ].join('\r\n');
        expect(normalize(input)).toBe(plainPipeline(input));
    });

    it('restores code exactly when the source contains placeholder-like text', () => {
        const input =
            'STREAMDOWN_CODE_0_ `\\[a\\]` STREAMDOWN_CODE_1_ \\[ b \\]';
        expect(normalize(input)).toBe(
            'STREAMDOWN_CODE_0_ `\\[a\\]` STREAMDOWN_CODE_1_ \n$$\nb\n$$'
        );
    });

    it('keeps CRLF code literal and normalizes line endings like before', () => {
        const output = normalize('`\\[a\\]`\r\n\r\n```\r\n\\[b\\]\r\n```\r\n\\[ c \\]');
        expect(output).toBe('`\\[a\\]`\n\n```\n\\[b\\]\n```\n\n$$\nc \n$$');
    });

    it('does not let an unclosed bracket opener swallow a later code block', () => {
        const input = '\\[ x +\n\n```\n\\[code\\]\n```\n\n\\[ y \\]';
        expect(normalize(input)).toBe(
            '\\[ x +\n\n```\n\\[code\\]\n```\n\n$$\ny \n$$'
        );
    });

    it('does not pair bracket math across an inline code span', () => {
        const input = 'See \\[ a `b` c \\] and \\[ d \\] here.';
        expect(normalize(input)).toBe(
            'See \\[ a `b` c \\] and \n$$\nd\n$$\n here.'
        );
    });

    it('keeps an unrelated mid-line opener from disabling later math', () => {
        const input = 'Type \\[ to open.\n\n`code`\n\n\\[ y = 2 \\]';
        expect(normalize(input)).toBe(
            'Type \\[ to open.\n\n`code`\n\n$$\ny = 2 \n$$'
        );
    });

    it('does not rewrite matrices in code or pair a matrix across code', () => {
        const literal = [
            'The \\begin{matrix} environment, see `\\end{matrix}`.',
            '',
            '```latex',
            '\\begin{matrix}1 & 2',
            '3 & 4\\end{matrix}',
            '```',
            '',
            '',
        ].join('\n');
        const prose = '$$\\begin{matrix}5 & 6\\\\ 7 & 8\\end{matrix}$$';
        expect(normalize(literal + prose)).toBe(literal + plainPipeline(prose));
    });

    it('clamps code ranges from a repaired streaming parse to the source', () => {
        const output = normalizeLatexOutsideCode('Literal `\\[x\\]', (markdown) =>
            markdownParser.parse(`${markdown}\``)
        );
        expect(output).toBe('Literal `\\[x\\]');
    });
});
