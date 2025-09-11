import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// This mirrors the example chunks in examples/basic/App.vue (joined here instead of streamed).
// It ensures the demo content continues to parse & render all key feature types when fully assembled.
const baseChunks: string[] = [
    '# Hello Vuedown Streaming Demo\n\n',
    'This content arrives in small chunks to simulate a live AI / notes feed.\n\n',
    '## 1. Quick Bullets\n- One\n',
    '- Two (with **bold** text)\n',
    '- Three with `inline code` and $E=mc^2$\n\n',
    '## 2. Table Snapshot\n',
    '| Framework | Stars | Trend |\n',
    '| --------- | -----:| :---- |\n',
    '| Vue       | 200k  | ++    |\n',
    '| Bun       |  70k  | ++    |\n',
    '| Vite      |  65k  | +     |\n\n',
    'Small paragraph after table explaining metrics. Numbers are illustrative only.\n\n',
    '### 3. Code (TypeScript)\n',
    '```ts\nexport function fib(n: number): number {\n  return n < 2 ? n : fib(n-1) + fib(n-2);\n}\n```\n\n',
    '### 4. Math Block\n',
    '$$\\int_0^1 x^2 \\, dx = 1/3$$\n',
    'And inline fraction $\\frac{a+b}{c+d}$.\n\n',
    '### 5. Mermaid Flow\n',
    '```mermaid\nflowchart LR\n  User[User] --> API((API)) --> Worker{{Worker}} --> DB[(Database)]\n  API --> Cache[(Cache)]\n```\n\n',
    '### 6. Mermaid Sequence\n',
    '```mermaid\nsequenceDiagram\n  participant A as Client\n  participant B as Server\n  A->>B: Request data\n  B-->>A: Stream chunk 1\n  B-->>A: Stream chunk 2\n  B-->>A: Stream chunk 3\n```\n\n',
    '### 7. Blockquote & Horizontal Rule\n',
    '> "Streaming markdown lets users see progress early."\n\n',
    '---\n',
    '### 8. Nested List\n',
    '- Parent A\n  - Child A1\n  - Child A2\n- Parent B\n\n',
    '### 9. Finishing Up\n',
    'Final paragraph with another inline math $a^2 + b^2 = c^2$ and some *italic* text.\n',
    '---\n',
    '### 10. Additional Table\n',
    '| Metric | Value | Notes |\n',
    '| ------ | ----: | ----- |\n',
    '| Speed  |  1.2x | vs baseline |\n',
    '| Memory |  80MB | approximate |\n\n',
    '### 11. More Code (JSON)\n',
    '```json\n{"name":"demo","items":[1,2,3]}\n```\n\n',
    '### 12. Another Mermaid Graph\n',
    '```mermaid\ngantt\n  dateFormat  YYYY-MM-DD\n  title Adding More Content\n  section Phase 1\n  Task A :a1, 2025-09-01, 1d\n  Task B :after a1 , 1d\n```\n\n',
    '### 13. Heavy Paragraph\n',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(
        4
    ) + '\n',
    '### 14. Final Note\n',
    'End of extended stream example.\n',
    '### 15. Tasks & Strike\n',
    '- [x] Write docs\n- [ ] Add tests\n- [x] Ship ~~deprecated~~ feature\n\n',
    '### 16. Security Examples\n',
    '[Safe Link](https://example.com) [Bad Link](javascript:alert(1))\n\n',
    'Allowed image: ![ok](https://cdn.example.com/img.png) Disallowed image: ![bad](http://bad.local/x.png)\n\n',
    '### 17. Matrix Math\n',
    '$$\\begin{matrix}1 & 2\\\\ 3 & 4\\end{matrix}$$\n',
    '### 18. Syntax Highlight Sampler\n',
    'Below are multiple fenced code blocks to exercise Shiki multi-language highlighting.\n',
    '```python\nimport math\nvals = [math.sin(x/10) for x in range(5)]\n```\n\n',
    '```bash\n#!/usr/bin/env bash\necho "Highlight test" | tr a-z A-Z\n```\n\n',
    '```json\n{"demo":true,"items":[1,2,3],"nested":{"ok":1}}\n```\n\n',
    '```diff\n@@ Added feature @@\n+ new line\n- old line\n```\n\n',
    '### 19. Progressive Code Block (Split Streaming Test)\n',
    "```js\nfunction greet(name) {\n  console.log('hi ' + name);\n}\nfor (let i=0;i<3;i++) console.log(i);\nconst obj = { a: 1, b: 2 };\nasync function main() {\n  await new Promise(r => setTimeout(r, 10));\n  console.log('done');\n}\nmain();\n```\n\n",
    '### 20. Incomplete Constructs Demo (start)\n',
    'We now stream several *intentionally* broken / partial elements.\n\n',
    '#### 20.a Second Progressive Code Fence (opens only)\n',
    '```ts\nexport async function partialFeature(id: string) {\n  const data = await fetch(`/api/item/${id}`);\n  if (!data.ok) {\n    throw new Error("failed");\n  }\n  const json = await data.json();\n  return json.value\n}\n```\n\n',
    'Closing inline pieces: italic *done* and **bold done** plus `code start` now closed and link [Example](https://example.com) ok.\n\n',
    '$$ & 5 & 6\\\\ 7 & 8\\n\\end{matrix}$$\n\n',
    'Completed paragraph: Streaming lets us start reading before the model actually finishes thinking about how it wants to end the sentence—now complete.\n\n',
    '### 22. Final Wrap\n',
    'All previously incomplete constructs should now appear fully rendered without duplication.\n\n',
];

const fullContent = baseChunks.join('');

describe('Example App.vue content', () => {
    it('renders key feature markers', async () => {
        const html = await renderToString(
            h(StreamMarkdown, { content: fullContent })
        );
        // Code blocks
        expect(
            html.split('data-streamdown="code-block"').length
        ).toBeGreaterThan(3);
        // Mermaid containers (SSR loading state still has the data attribute)
        expect(html).toContain('data-streamdown="mermaid"');
        // KaTeX output (display math)
        expect(html).toContain('katex');
        // Task list checkboxes
        expect(html).toContain('type="checkbox"');
        // Table markup present
        expect(html).toContain('<table');
        // Hardened link should keep https and drop javascript: link (only text remains)
        expect(html).toContain('href="https://example.com"');
        expect(html).not.toContain('javascript:alert');
    });
});
