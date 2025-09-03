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
