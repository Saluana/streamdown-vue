const linkImagePattern = /(!?\[)([^\]]*?)$/;
const boldPattern = /(\*\*)([^*]*?)$/;
const italicPattern = /(__)([^_]*?)$/;
const boldItalicPattern = /(\*\*\*)([^*]*?)$/;
const singleAsteriskPattern = /(\*)([^*]*?)$/;
const singleUnderscorePattern = /(_)([^_]*?)$/;
const strikethroughPattern = /(~~)([^~]*?)$/;
// Removed inlineKatexPattern - no longer processing single dollar signs
const blockKatexPattern = /(\$\$)([^$]*?)$/;

// The handlers below mask the same text in turn, so reuse the last result.
let lastMaskInput: string | null = null;
let lastMaskOutput = '';

// Replaces every character inside a fenced code block or an inline code span
// with a space (newlines are kept so line-based checks keep working). Counting
// delimiters on the masked text keeps code content like globs (`**/*.ts`) or
// like python dunder functions (`__init__`) from being mistaken for unterminated
// emphasis. An unterminated code region masks the rest of the text, since anything
// after the opening delimiter is code until it is closed.
const maskCodeRegions = (text: string): string => {
    if (text === lastMaskInput) return lastMaskOutput;
    const chars = text.split('');
    const maskRange = (start: number, end: number) => {
        for (let i = start; i < end; i++) {
            if (chars[i] !== '\n') {
                chars[i] = ' ';
            }
        }
    };

    let index = 0;
    while (index < text.length) {
        if (text[index] !== '`') {
            index++;
            continue;
        }

        let runEnd = index;
        while (runEnd < text.length && text[runEnd] === '`') {
            runEnd++;
        }
        const runLength = runEnd - index;
        let lineStart = index;
        while (text[lineStart - 1] === ' ' || text[lineStart - 1] === '\t') {
            lineStart--;
        }
        const atLineStart = lineStart === 0 || text[lineStart - 1] === '\n';

        // A run of three or more backticks at the start of a line opens a
        // fenced block that runs until a closing fence of at least that length.
        if (runLength >= 3 && atLineStart) {
            const closingFence = new RegExp(
                `\\n[ \\t]*\`{${runLength},}[ \\t]*(?:\\n|$)`
            );
            const rest = text.slice(runEnd);
            const closingMatch = rest.match(closingFence);
            const end =
                closingMatch && closingMatch.index !== undefined
                    ? runEnd + closingMatch.index + closingMatch[0].length
                    : text.length;
            maskRange(index, end);
            index = end;
            continue;
        }

        // Otherwise this opens an inline code span, closed by a backtick run of
        // exactly the same length.
        let cursor = runEnd;
        let closed = false;
        while (cursor < text.length) {
            if (text[cursor] !== '`') {
                cursor++;
                continue;
            }
            let closeEnd = cursor;
            while (closeEnd < text.length && text[closeEnd] === '`') {
                closeEnd++;
            }
            if (closeEnd - cursor === runLength) {
                cursor = closeEnd;
                closed = true;
                break;
            }
            cursor = closeEnd;
        }
        const end = closed ? cursor : text.length;
        maskRange(index, end);
        index = end;
    }

    lastMaskInput = text;
    lastMaskOutput = chars.join('');
    return lastMaskOutput;
};

// Handles incomplete links and images by removing them if not closed
// Brackets inside code are literal, so they are matched on masked text
const handleIncompleteLinksAndImages = (text: string): string => {
    const masked = maskCodeRegions(text);
    const linkMatch = masked.match(linkImagePattern);

    if (linkMatch) {
        const group = linkMatch[1];
        if (group) {
            const startIndex = masked.lastIndexOf(group);
            if (startIndex >= 0) {
                return text.substring(0, startIndex);
            }
        }
    }

    return text;
};

// Completes incomplete bold formatting (**)
const handleIncompleteBold = (text: string): string => {
    const masked = maskCodeRegions(text);
    const boldMatch = masked.match(boldPattern);

    if (boldMatch) {
        const asteriskPairs = (masked.match(/\*\*/g) || []).length;
        if (asteriskPairs % 2 === 1) {
            return `${text}**`;
        }
    }

    return text;
};

// Completes incomplete italic formatting with double underscores (__)
const handleIncompleteDoubleUnderscoreItalic = (text: string): string => {
    const masked = maskCodeRegions(text);
    const italicMatch = masked.match(italicPattern);

    if (italicMatch) {
        const underscorePairs = (masked.match(/__/g) || []).length;
        if (underscorePairs % 2 === 1) {
            return `${text}__`;
        }
    }

    return text;
};

// Counts single asterisks that are not part of double asterisks, not escaped, and not list markers
const countSingleAsterisks = (text: string): number => {
    let count = 0;
    let lineHasContent = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index]!;
        if (char === '\n') {
            lineHasContent = false;
            continue;
        }
        if (char === '*') {
            const prevChar = text[index - 1];
            const nextChar = text[index + 1];
            // An asterisk after only whitespace on its line and followed by
            // a space or tab is a list marker.
            const listMarker =
                !lineHasContent && (nextChar === ' ' || nextChar === '\t');
            if (
                prevChar !== '\\' &&
                !listMarker &&
                prevChar !== '*' &&
                nextChar !== '*'
            ) {
                count++;
            }
        }
        if (!lineHasContent && char.trim() !== '') lineHasContent = true;
    }
    return count;
};

// Completes incomplete italic formatting with single asterisks (*)
const handleIncompleteSingleAsteriskItalic = (text: string): string => {
    const masked = maskCodeRegions(text);
    const singleAsteriskMatch = masked.match(singleAsteriskPattern);

    if (singleAsteriskMatch) {
        const singleAsterisks = countSingleAsterisks(masked);
        if (singleAsterisks % 2 === 1) {
            return `${text}*`;
        }
    }

    return text;
};

// Counts single underscores that are not part of double underscores, not escaped, and not in math blocks
// (between $ or $$). Math state is tracked in the same pass instead of rescanning per underscore.
const countSingleUnderscores = (text: string): number => {
    let count = 0;
    let inInlineMath = false;
    let inBlockMath = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // Skip escaped dollar signs
        if (char === '\\' && text[i + 1] === '$') {
            i++;
            continue;
        }
        if (char === '$') {
            // Check for block math ($$)
            if (text[i + 1] === '$') {
                inBlockMath = !inBlockMath;
                i++; // Skip the second $
                inInlineMath = false; // Block math takes precedence
            } else if (!inBlockMath) {
                // Only toggle inline math if not in block math
                inInlineMath = !inInlineMath;
            }
            continue;
        }
        if (char !== '_' || inInlineMath || inBlockMath) continue;
        const prevChar = text[i - 1];
        const nextChar = text[i + 1];
        // Skip if escaped with backslash or part of a double underscore
        if (prevChar !== '\\' && prevChar !== '_' && nextChar !== '_') {
            count++;
        }
    }
    return count;
};

// Completes incomplete italic formatting with single underscores (_)
const handleIncompleteSingleUnderscoreItalic = (text: string): string => {
    const masked = maskCodeRegions(text);
    const singleUnderscoreMatch = masked.match(singleUnderscorePattern);

    if (singleUnderscoreMatch) {
        const singleUnderscores = countSingleUnderscores(masked);
        if (singleUnderscores % 2 === 1) {
            return `${text}_`;
        }
    }

    return text;
};

const fenceLine = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})([^\n]*)$/;

// Closes a single-backtick code span left open at the end of the text. Only the
// last paragraph can still be streaming, so fenced blocks are skipped and spans
// never reach back across a blank line. A backtick run opens a span only when a
// run of the same length follows; otherwise it is literal, so `` a`b `` or an
// unmatched ``quote'' does not hide a later single-backtick span.
export const closeOpenInlineCode = (text: string): string => {
    let paragraphStart = 0;
    let fence = '';
    for (let lineStart = 0; lineStart <= text.length; ) {
        let lineEnd = text.indexOf('\n', lineStart);
        if (lineEnd === -1) lineEnd = text.length;
        const line = text.slice(lineStart, lineEnd);
        const match = fenceLine.exec(line);
        const marker = match?.[1] ?? '';
        const rest = match?.[2] ?? '';
        if (fence) {
            if (
                marker[0] === fence[0] &&
                marker.length >= fence.length &&
                !rest.trim()
            ) {
                fence = '';
                paragraphStart = lineEnd + 1;
            }
        } else if (marker && (marker[0] === '~' || !rest.includes('`'))) {
            fence = marker;
        } else if (lineEnd < text.length && !line.trim()) {
            paragraphStart = lineEnd + 1;
        }
        lineStart = lineEnd + 1;
    }
    if (fence) return text;

    const runs = (text.slice(paragraphStart).match(/`+/g) ?? []).map(
        (run) => run.length
    );
    // Index of the next run with the same length, or -1.
    const nextSameLength: number[] = [];
    const lastByLength = new Map<number, number>();
    for (let i = runs.length - 1; i >= 0; i--) {
        nextSameLength[i] = lastByLength.get(runs[i]!) ?? -1;
        lastByLength.set(runs[i]!, i);
    }
    for (let i = 0; i < runs.length; i++) {
        if (nextSameLength[i] !== -1) i = nextSameLength[i]!;
        else if (runs[i] === 1) return `${text}\``;
    }
    return text;
};

// Completes incomplete inline code formatting (`)
// Avoids completing if inside an incomplete code block
const handleIncompleteInlineCode = (text: string): string => {
    // Check if we have inline triple backticks (starts with ``` and should end with ```)
    // This pattern should ONLY match truly inline code (no newlines)
    // Examples: ```code``` or ```python code```
    const inlineTripleBacktickMatch = text.match(/^```[^`\n]*```?$/);
    if (inlineTripleBacktickMatch && !text.includes('\n')) {
        // Check if it ends with exactly 2 backticks (incomplete)
        if (text.endsWith('``') && !text.endsWith('```')) {
            return `${text}` + '`';
        }
        // Already complete inline triple backticks
        return text;
    }

    // Check if we're inside a multi-line code block (complete or incomplete)
    const allTripleBackticks = (text.match(/```/g) || []).length;
    const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;

    // Don't modify text if we have complete multi-line code blocks (even pairs of ```)
    if (
        allTripleBackticks > 0 &&
        allTripleBackticks % 2 === 0 &&
        text.includes('\n')
    ) {
        // We have complete multi-line code blocks, don't add any backticks
        return text;
    }

    // Special case: if text ends with ```\n (triple backticks followed by newline)
    // This is actually a complete code block, not incomplete
    if (text.endsWith('```\n') || text.endsWith('```')) {
        // Count all triple backticks - if even, it's complete
        if (allTripleBackticks % 2 === 0) {
            return text;
        }
    }

    return insideIncompleteCodeBlock ? text : closeOpenInlineCode(text);
};

// Completes incomplete strikethrough formatting (~~)
const handleIncompleteStrikethrough = (text: string): string => {
    const masked = maskCodeRegions(text);
    const strikethroughMatch = masked.match(strikethroughPattern);

    if (strikethroughMatch) {
        const tildePairs = (masked.match(/~~/g) || []).length;
        if (tildePairs % 2 === 1) {
            return `${text}~~`;
        }
    }

    return text;
};

// Counts single dollar signs that are not part of double dollar signs and not escaped
const countSingleDollarSigns = (text: string): number => {
    return text.split('').reduce((acc, char, index) => {
        if (char === '$') {
            const prevChar = text[index - 1];
            const nextChar = text[index + 1];
            // Skip if escaped with backslash
            if (prevChar === '\\') {
                return acc;
            }
            if (prevChar !== '$' && nextChar !== '$') {
                return acc + 1;
            }
        }
        return acc;
    }, 0);
};

// Completes incomplete block KaTeX formatting ($$)
const handleIncompleteBlockKatex = (text: string): string => {
    // Count all $$ pairs in the text
    const masked = maskCodeRegions(text);
    const dollarPairs = (masked.match(/\$\$/g) || []).length;
    // if odd number of $$ we attempt to close it later (no logging in production)

    // If we have an even number of $$, the block is complete
    if (dollarPairs % 2 === 0) {
        return text;
    }

    // If there is an unmatched \begin{...} environment (e.g. matrix, pmatrix, align)
    // we defer auto-closing the math block so the environment can finish in later chunks.
    // Otherwise we'd split the environment across two display math blocks and break KaTeX.
    const beginCount = (masked.match(/\\begin\{[^}]+\}/g) || []).length;
    const endCount = (masked.match(/\\end\{[^}]+\}/g) || []).length;
    // If we have any imbalance in environments (either missing \end OR missing \begin),
    // defer auto-closing so that KaTeX does not attempt to parse a malformed block
    // which commonly triggers alignment (&) parse errors in streaming scenarios.
    if (beginCount !== endCount) return text; // leave it open for next chunk

    // If we have an odd number, add closing $$
    // Check if this looks like a multi-line math block (contains newlines after opening $$)
    const firstDollarIndex = masked.indexOf('$$');
    const hasNewlineAfterStart =
        firstDollarIndex !== -1 &&
        masked.indexOf('\n', firstDollarIndex) !== -1;

    // For multi-line blocks, add newline before closing $$ if not present
    if (hasNewlineAfterStart && !text.endsWith('\n')) return `${text}\n$$`;

    // For inline blocks or when already ending with newline, just add $$
    return `${text}$$`;
};

// Completes incomplete inline KaTeX formatting ($)
// Note: Since we've disabled single dollar math delimiters in remarkMath,
// we should not auto-complete single dollar signs as they're likely currency symbols
const handleIncompleteInlineKatex = (text: string): string => {
    // Don't process single dollar signs - they're likely currency symbols, not math
    // Only process block math ($$) which is handled separately
    return text;
};

// Counts triple asterisks that are not part of quadruple or more asterisks
const countTripleAsterisks = (text: string): number => {
    let count = 0;
    const matches = text.match(/\*+/g) || [];

    for (const match of matches) {
        // Count how many complete triple asterisks are in this sequence
        const asteriskCount = match.length;
        if (asteriskCount >= 3) {
            // Each group of exactly 3 asterisks counts as one triple asterisk marker
            count += Math.floor(asteriskCount / 3);
        }
    }

    return count;
};

// Completes incomplete bold-italic formatting (***)
const handleIncompleteBoldItalic = (text: string): string => {
    // Don't process if text is only asterisks and has 4 or more consecutive asterisks
    // This prevents cases like **** from being treated as incomplete ***
    if (/^\*{4,}$/.test(text)) {
        return text;
    }

    const masked = maskCodeRegions(text);
    const boldItalicMatch = masked.match(boldItalicPattern);

    if (boldItalicMatch) {
        const tripleAsteriskCount = countTripleAsterisks(masked);
        if (tripleAsteriskCount % 2 === 1) {
            return `${text}***`;
        }
    }

    return text;
};

// Auto-closes unbalanced markdown tokens so streaming content always renders
export const parseIncompleteMarkdown = (text: string): string => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let result = text;
    const startLen = result.length;
    const startDollarPairs = (result.match(/\$\$/g) || []).length;
    // Only log if math related content present
    // (math debug logging removed for production)

    // Handle incomplete links and images first (removes content)
    result = handleIncompleteLinksAndImages(result);

    // Handle various formatting completions
    // Handle triple asterisks first (most specific)
    result = handleIncompleteBoldItalic(result);
    result = handleIncompleteBold(result);
    result = handleIncompleteDoubleUnderscoreItalic(result);
    result = handleIncompleteSingleAsteriskItalic(result);
    result = handleIncompleteSingleUnderscoreItalic(result);
    result = handleIncompleteInlineCode(result);
    result = handleIncompleteStrikethrough(result);

    // Handle KaTeX formatting (only block math with $$)
    result = handleIncompleteBlockKatex(result);
    // Note: We don't handle inline KaTeX with single $ as they're likely currency symbols

    // (modification logging removed)
    return result;
};
