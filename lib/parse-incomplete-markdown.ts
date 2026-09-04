const linkImagePattern = /(!?\[)([^\]]*?)$/;
const boldPattern = /(\*\*)([^*]*?)$/;
const italicPattern = /(__)([^_]*?)$/;
const boldItalicPattern = /(\*\*\*)([^*]*?)$/;
const singleAsteriskPattern = /(\*)([^*]*?)$/;
const singleUnderscorePattern = /(_)([^_]*?)$/;
const inlineCodePattern = /(`)([^`]*?)$/;
const strikethroughPattern = /(~~)([^~]*?)$/;
// Removed inlineKatexPattern - no longer processing single dollar signs
const blockKatexPattern = /(\$\$)([^$]*?)$/;

// Replaces every character inside a fenced code block or an inline code span
// with a space (newlines are kept so line-based checks keep working). Counting
// delimiters on the masked text keeps code content like globs (`**/*.ts`) or
// like python dunder functions (`__init__`) from being mistaken for unterminated
// emphasis. An unterminated code region masks the rest of the text, since anything
// after the opening delimiter is code until it is closed.
const maskCodeRegions = (text: string): string => {
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
        const atLineStart = /(?:^|\n)[ \t]*$/.test(text.slice(0, index));

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

    return chars.join('');
};

// Handles incomplete links and images by removing them if not closed
const handleIncompleteLinksAndImages = (text: string): string => {
    const linkMatch = text.match(linkImagePattern);

    if (linkMatch) {
        const group = linkMatch[1];
        if (group) {
            const startIndex = text.lastIndexOf(group);
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
    return text.split('').reduce((acc, char, index) => {
        if (char === '*') {
            const prevChar = text[index - 1];
            const nextChar = text[index + 1];
            // Skip if escaped with backslash
            if (prevChar === '\\') {
                return acc;
            }
            // Check if this is a list marker (asterisk at start of line followed by space)
            // Look backwards to find the start of the current line
            let lineStartIndex = index;
            for (let i = index - 1; i >= 0; i--) {
                if (text[i] === '\n') {
                    lineStartIndex = i + 1;
                    break;
                }
                if (i === 0) {
                    lineStartIndex = 0;
                    break;
                }
            }
            // Check if this asterisk is at the beginning of a line (with optional whitespace)
            const beforeAsterisk = text.substring(lineStartIndex, index);
            if (
                beforeAsterisk.trim() === '' &&
                (nextChar === ' ' || nextChar === '\t')
            ) {
                // This is likely a list marker, don't count it
                return acc;
            }
            if (prevChar !== '*' && nextChar !== '*') {
                return acc + 1;
            }
        }
        return acc;
    }, 0);
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

// Check if a position is within a math block (between $ or $$)
const isWithinMathBlock = (text: string, position: number): boolean => {
    // Count dollar signs before this position
    let inInlineMath = false;
    let inBlockMath = false;

    for (let i = 0; i < text.length && i < position; i++) {
        // Skip escaped dollar signs
        if (text[i] === '\\' && text[i + 1] === '$') {
            i++; // Skip the next character
            continue;
        }

        if (text[i] === '$') {
            // Check for block math ($$)
            if (text[i + 1] === '$') {
                inBlockMath = !inBlockMath;
                i++; // Skip the second $
                inInlineMath = false; // Block math takes precedence
            } else if (!inBlockMath) {
                // Only toggle inline math if not in block math
                inInlineMath = !inInlineMath;
            }
        }
    }

    return inInlineMath || inBlockMath;
};

// Counts single underscores that are not part of double underscores, not escaped, and not in math blocks
const countSingleUnderscores = (text: string): number => {
    return text.split('').reduce((acc, char, index) => {
        if (char === '_') {
            const prevChar = text[index - 1];
            const nextChar = text[index + 1];
            // Skip if escaped with backslash
            if (prevChar === '\\') {
                return acc;
            }
            // Skip if within math block
            if (isWithinMathBlock(text, index)) {
                return acc;
            }
            if (prevChar !== '_' && nextChar !== '_') {
                return acc + 1;
            }
        }
        return acc;
    }, 0);
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

// Checks if a backtick at position i is part of a triple backtick sequence
const isPartOfTripleBacktick = (text: string, i: number): boolean => {
    const isTripleStart = text.substring(i, i + 3) === '```';
    const isTripleMiddle = i > 0 && text.substring(i - 1, i + 2) === '```';
    const isTripleEnd = i > 1 && text.substring(i - 2, i + 1) === '```';

    return isTripleStart || isTripleMiddle || isTripleEnd;
};

// Counts single backticks that are not part of triple backticks
const countSingleBackticks = (text: string): number => {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '`' && !isPartOfTripleBacktick(text, i)) {
            count++;
        }
    }
    return count;
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

    const inlineCodeMatch = text.match(inlineCodePattern);

    if (inlineCodeMatch && !insideIncompleteCodeBlock) {
        const singleBacktickCount = countSingleBackticks(text);
        if (singleBacktickCount % 2 === 1) {
            return `${text}` + '`';
        }
    }

    return text;
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
