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

const matrixEnv = /(\\begin\{(?:b|p|B|v|V)?matrix\})([\s\S]*?)(\\end\{(?:b|p|B|v|V)?matrix\})/g;

export function fixMatrix(content: string): string {
  return content.replace(matrixEnv, (_, begin, body, end) => {
    const rows = body
      .split('\n')
      .map((r: string) => r.trim())
      .filter((r: string) => r.length);
    const fixed = rows
      .map((r: string, idx: number) => {
        // Replace solitary backslash line breaks with \\\
        r = r.replace(/\\(?!\\)/g, '\\\\');
        r = r.replace(/\\\\$/, '');
        return idx < rows.length - 1 ? `${r} \\\\` : r;
      })
      .join('\n');
    return `${begin}\n${fixed}\n${end}`;
  });
}
