export function fixDollarSignMath(content: string): string {
    let result = '';
    let i = 0;
    while (i < content.length) {
        const char = content[i];
        if (char === '$') {
            // handle block math $$...$$
            if (content[i + 1] === '$') {
                const closing = content.indexOf('$$', i + 2);
                if (closing !== -1) {
                    result += content.slice(i, closing + 2);
                    i = closing + 2;
                    continue;
                }
                // unmatched $$, escape both
                result += '\\$\\$';
                i += 2;
                continue;
            }
            // handle inline math $...$
            let j = i + 1;
            let found = -1;
            while (j < content.length) {
                if (content[j] === '\\') {
                    j += 2;
                    continue;
                }
                if (content[j] === '$') {
                    found = j;
                    break;
                }
                if (content[j] === '\n') break;
                j++;
            }
            if (found !== -1) {
                result += content.slice(i, found + 1);
                i = found + 1;
                continue;
            }
            // unmatched single $
            result += '\\$';
            i++;
            continue;
        }
        result += char;
        i++;
    }
    return result;
}

const matrixEnv =
    /(\\begin\{(?:b|p|B|v|V)?matrix\})([\s\S]*?)(\\end\{(?:b|p|B|v|V)?matrix\})/g;

export function fixMatrix(content: string): string {
    return content.replace(
        matrixEnv,
        (
            match: string,
            begin: string,
            body: string,
            end: string,
            offset: number
        ) => {
            // Split on raw newlines; ignore purely empty lines.
            let rawRows = body
                .split(/\n+/g)
                .map((r) => r.trim())
                .filter((r) => r.length > 0 && r !== '\\');
            // If a row contains internal \\ delimiters on the same physical line, expand them.
            if (rawRows.some((r) => /\\\\/.test(r))) {
                const expanded: string[] = [];
                for (const r of rawRows) {
                    if (/\\\\/.test(r)) {
                        // Split on explicit row breaks, drop empty trailing segments
                        const segs = r
                            .split(/\\\\\s*/)
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0 && s !== '\\');
                        for (const seg of segs) expanded.push(seg);
                    } else {
                        expanded.push(r);
                    }
                }
                rawRows = expanded;
            }
            if (rawRows.length === 0) return `${begin}\n${end}`;
            const fixed = rawRows
                .map((row, i) => {
                    const original = row;
                    // If already has a proper \\ (two backslashes) at end, keep it.
                    if (i < rawRows.length - 1) {
                        if (/\\\\\s*$/.test(row)) return row; // already ends with \\
                        // If it ends with a single backslash (likely truncated), normalize to two.
                        if (/\\\s*$/.test(row))
                            return row.replace(/\\\s*$/, ' \\\\');
                        return row + ' \\\\';
                    }
                    // Last row: remove accidental trailing single backslash
                    return row.replace(/\\\s*$/, '');
                })
                .join('\n');
            return `${begin}\n${fixed}\n${end}`;
        }
    );
}

// Ensure display math blocks containing matrix environments are on their own lines:
// $$ <one line matrix> $$  =>  $$\n<multiline body>\n$$
// This helps remark-math + KaTeX treat them consistently as block math.
export function normalizeDisplayMath(content: string): string {
    return content.replace(/\$\$([\s\S]*?)\$\$/g, (full, inner) => {
        if (!/\\begin\{(?:b|p|B|v|V)?matrix\}/.test(inner)) return full; // only touch matrix blocks
        // If already starts/ends with newlines (block style) keep as-is.
        const startsNl = /^\s*\n/.test(inner);
        const endsNl = /\n\s*$/.test(inner);
        if (startsNl && endsNl) return full; // already normalized
        const trimmed = inner.trim();
        // If it is a single line, try to pretty format rows (they may already be handled by fixMatrix)
        const pretty = trimmed
            .replace(/(\\begin\{[^}]+\})/, '$1\n')
            .replace(/(\\\\)\s*(?=\S)/g, '$1\n') // each \\ followed by non-space becomes row break
            .replace(/(\\end\{[^}]+\})/, '\n$1');
        return '$$\n' + pretty.trim() + '\n$$';
    });
}

export function normalizeBracketDisplayMath(content: string): string {
    const normalized = content.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const output: string[] = [];
    let inFence = false;
    let fenceMarker = '';
    let fenceLength = 0;
    let inMath = false;
    let mathIndent = '';
    let mathStripIndent = '';

    const pushMathLine = (line: string) => {
        output.push(line.length ? mathIndent + line : mathIndent);
    };

    const stripMathIndent = (line: string) => {
        if (mathIndent && line.startsWith(mathIndent)) {
            return line.slice(mathIndent.length);
        }
        if (mathStripIndent && line.startsWith(mathStripIndent)) {
            return line.slice(mathStripIndent.length);
        }
        return line.trimStart();
    };

    for (const line of lines) {
        if (!inMath) {
            const fenceMatch = line.match(/^(\s*(?:>\s*)*)([`~]{3,})/);
            if (fenceMatch) {
                const marker = fenceMatch[2] ?? '';
                if (!inFence) {
                    inFence = true;
                    fenceMarker = marker[0] ?? '';
                    fenceLength = marker.length;
                } else if (
                    marker[0] === fenceMarker &&
                    marker.length >= fenceLength
                ) {
                    inFence = false;
                    fenceMarker = '';
                    fenceLength = 0;
                }
                output.push(line);
                continue;
            }
        }

        if (inFence) {
            output.push(line);
            continue;
        }

        if (!inMath) {
            const startMatch = line.match(/^(\s*(?:>\s*)*)\\\[(.*)$/);
            if (!startMatch) {
                output.push(line);
                continue;
            }
            inMath = true;
            mathStripIndent = startMatch[1] ?? '';
            mathIndent =
                mathStripIndent.includes('>') && !/\s$/.test(mathStripIndent)
                    ? mathStripIndent + ' '
                    : mathStripIndent;
            if (
                output.length > 0 &&
                output[output.length - 1]?.trim().length
            ) {
                output.push(
                    mathIndent.includes('>') ? mathIndent : ''
                );
            }
            output.push(mathIndent + '$$');
            const remainder = startMatch[2] ?? '';
            const closingIndex = remainder.indexOf('\\]');
            if (closingIndex !== -1) {
                const body = remainder.slice(0, closingIndex);
                if (body.trim().length > 0 || body.length > 0) {
                    pushMathLine(stripMathIndent(body).trimStart());
                }
                output.push(mathIndent + '$$');
                inMath = false;
                const trailing = remainder.slice(closingIndex + 2);
                if (trailing.length > 0) {
                    output.push(mathIndent + trailing.trimStart());
                }
            } else if (remainder.trim().length > 0) {
                pushMathLine(stripMathIndent(remainder).trimStart());
            }
            continue;
        }

        const closingIndex = line.indexOf('\\]');
        if (closingIndex !== -1) {
            const before = line.slice(0, closingIndex);
            if (before.trim().length > 0 || before.length > 0) {
                pushMathLine(stripMathIndent(before));
            }
            output.push(mathIndent + '$$');
            inMath = false;
            const trailing = line.slice(closingIndex + 2);
            if (trailing.length > 0) {
                output.push(mathIndent + trailing.trimStart());
            }
        } else {
            pushMathLine(stripMathIndent(line));
        }
    }
    // Second pass: upgrade inline bracket math occurrences that appear mid-line
    // e.g. "Intro text then \\[…\\] continues" -> separate display block.
    // We intentionally skip lines inside code fences (tracked separately here).
    const upgraded: string[] = [];
    let inFence2 = false;
    let fenceChar2 = '';
    let fenceLen2 = 0;
    for (const rawLine of output) {
        // Guard against undefined when using noUncheckedIndexedAccess (though rawLine is always string in for..of)
        const line: string = rawLine ?? '';
        // Match fences possibly preceded by blockquote markers similar to first pass
        const fenceMatch = line.match(/^(\s*(?:>\s*)*)([`~]{3,})/);
        if (fenceMatch) {
            const marker = fenceMatch[2] ?? '';
            if (!inFence2) {
                inFence2 = true;
                fenceChar2 = marker[0] ?? '';
                fenceLen2 = marker.length;
            } else if (
                marker[0] === fenceChar2 &&
                marker.length >= fenceLen2
            ) {
                inFence2 = false;
                fenceChar2 = '';
                fenceLen2 = 0;
            }
            upgraded.push(line);
            continue;
        }
        if (inFence2) {
            upgraded.push(line);
            continue;
        }
        if (/\\\[.*?\\\]/.test(line) && !/^\s*\\\[/.test(line)) {
            const pieces: string[] = [];
            const inlineRegex = /\\\[([^\n]*?)\\\]/g;
            let lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = inlineRegex.exec(line))) {
                const before = line.slice(lastIndex, m.index);
                if (before.trim().length) pieces.push(before);
                const inner = (m[1] ?? '').trim();
                pieces.push('$$');
                if (inner.length) pieces.push(inner);
                pieces.push('$$');
                lastIndex = m.index + m[0].length;
            }
            const after = line.slice(lastIndex);
            if (after.trim().length) pieces.push(after);
            for (const p of pieces) upgraded.push(p === '$$' ? '$$' : p);
        } else {
            upgraded.push(line);
        }
    }
    return upgraded.join('\n');
}
