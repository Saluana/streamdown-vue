const baseChunks: string[] = [
    `好的！KaTeX 是一个非常流行的数学公式渲染引擎。下面是一些常见的数学公式示例，使用 KaTeX 语法：

### 基本公式
1. **线性方程**：
   \\[ y = mx + b \\]`,
    `2. **二次方程**：
   \\[ ax^2 + bx + c = 0 \\]`,
    '### 17. Matrix Math\n',
    '$$\\begin{matrix}1 & 2\\\\ 3 & 4\\end{matrix}$$\n',
    '### 18. Syntax Highlight Sampler\n',
    'Below are multiple fenced code blocks to exercise Shiki multi-language highlighting.\n',
    '```python\nimport math\n\n# quick computation\nvals = [math.sin(x/10) for x in range(5)]\nprint(vals)\n```\n\n',
    '```bash\n#!/usr/bin/env bash\nset -euo pipefail\necho "Highlight test" | tr a-z A-Z\n```\n\n',
    '```json\n{"demo":true,"items":[1,2,3],"nested":{"ok":1}}\n```\n\n',
    '```diff\n@@ Added feature @@\n+ new line\n- old line\n```\n\n',
    '### 19. Progressive Code Block (Split Streaming Test)\n',
    '```js\n', // opening fence only
    'function greet(name) {\n',
    "  console.log('hi ' + name);\n",
    '}\n',
    '// more lines incoming...\n',
    'for (let i=0;i<3;i++) console.log(i);\n',
    'const obj = { a: 1, b: 2 };\n',
    '/* simulate long code arriving line by line */\n',
    'async function main() {\n',
    '  await new Promise(r => setTimeout(r, 10));\n',
    "  console.log('done');\n",
    '}\n',
    'main();\n',
    '```\n\n', // closing fence arrives much later
    '### 20. Incomplete Constructs Demo (start)\n',
    'We now stream several *intentionally* broken / partial elements.\n\n',
    '#### 20.a Second Progressive Code Fence (opens only)\n',
    '```ts\n',
    'export async function partialFeature(id: string) {\n',
    '  const data = await fetch(`/api/item/${id}`);\n',
    '  // still streaming more logic...\n',
    '  if (!data.ok) {\n',
    '    throw new Error("failed");\n',
    '  }\n',
    '  const json = await data.json();\n',
    '  return json.value', // (no trailing newline yet, keep fence open)
    '\n',
    '#### 20.b Inline formatting starts (no closes yet)\n',
    'This line has *italic start and **bold start plus `code start and an unmatched link [Example',
    '\n',
];

// Debug streaming test: accumulate chunks, render after each, and log diagnostics.
// We log the entire rendered HTML every 3 pushes (after chunk indices 2,5,8,...) and whenever
// the chunk containing the "### 19. Progressive Code Block" heading is processed.

import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

function containsRenderedDisplayMath(html: string, snippet: string): boolean {
    // Heuristic: snippet appears inside a katex-display block span
    const idx = html.indexOf(snippet);
    if (idx === -1) return false;
    // Look backward a bit for a katex-display wrapper
    const windowStart = Math.max(0, idx - 400);
    const context = html.slice(windowStart, idx + snippet.length + 50);
    return /katex-display/.test(context);
}

describe('DEBUG: KaTeX streaming around progressive code fence', () => {
    it('logs snapshots to investigate bracket math regression', async () => {
        let acc = '';
        const targetExpr = 'y = mx + b';
        const snapshots: {
            step: number;
            displayCount: number;
            exprRendered: boolean;
            openFences: number;
            has19: boolean;
        }[] = [];
        for (let i = 0; i < baseChunks.length; i++) {
            const chunk = baseChunks[i];
            acc += chunk;
            const app = h(StreamMarkdown, { content: acc });
            const html = await renderToString(app);
            const displayCount = (html.match(/katex-display/g) || []).length;
            const exprRendered = containsRenderedDisplayMath(html, targetExpr);
            const openFences = (acc.match(/```/g) || []).length % 2; // 1 if an unclosed fenced code block is currently open
            const has19 = /### 19\. Progressive Code Block/.test(acc);
            snapshots.push({
                step: i + 1,
                displayCount,
                exprRendered,
                openFences,
                has19,
            });

            const shouldDump = i % 3 === 2 || has19;
            if (shouldDump) {
                // Full HTML dump for debug (explicit markers for log scanning)
                console.log(
                    '\n===== STREAM DEBUG DUMP START step=' + (i + 1) + ' ====='
                );
                console.log(
                    'displayCount=' +
                        displayCount +
                        ' exprRendered=' +
                        exprRendered +
                        ' openFence=' +
                        openFences +
                        ' has19=' +
                        has19
                );
                console.log(html);
                console.log(
                    '===== STREAM DEBUG DUMP END step=' + (i + 1) + ' =====\n'
                );
            }
        }
        // Basic sanity: we should end with at least one rendered display math block.
        const last = snapshots[snapshots.length - 1]!; // guaranteed because baseChunks non-empty
        expect(last.displayCount).toBeGreaterThan(0);
        expect(last.exprRendered).toBe(true);
    }, 20000);
});
