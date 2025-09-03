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
        (_, begin: string, body: string, end: string) => {
            const rawRows = body
                .split(/\n+/g)
                .map((r) => r.trim())
                .filter(Boolean);
            if (rawRows.length === 0) return `${begin}\n${end}`;
            const fixed = rawRows
                .map((r, i) => {
                    // Remove any trailing single backslash
                    r = r.replace(/\\$/, '');
                    // If row already ends with \\ leave it, else add for all but last
                    if (i < rawRows.length - 1)
                        return /\\\\\s*$/.test(r) ? r : `${r} \\`;
                    return r;
                })
                .join('\n');
            return `${begin}\n${fixed}\n${end}`;
        }
    );
}
