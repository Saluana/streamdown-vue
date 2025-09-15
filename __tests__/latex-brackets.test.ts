import { describe, it, expect } from 'bun:test';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

const aiResponse = `好的！KaTeX 是一个非常流行的数学公式渲染引擎。下面是一些常见的数学公式示例，使用 KaTeX 语法：

### 基本公式
1. **线性方程**：
   \\[ y = mx + b \\]

2. **二次方程**：
   \\[ ax^2 + bx + c = 0 \\]

3. **指数函数**：
   \\[ y = e^x \\]

### 代数公式
1. **平方差公式**：
   \\[ a^2 - b^2 = (a - b)(a + b) \\]

2. **完全平方公式**：
   \\[ (a + b)^2 = a^2 + 2ab + b^2 \\]
   \\[ (a - b)^2 = a^2 - 2ab + b^2 \\]

### 几何公式
1. **圆的面积**：
   \\[ A = \pi r^2 \\]

2. **圆的周长**：
   \\[ C = 2\pi r \\]

3. **勾股定理**：
   \\[ a^2 + b^2 = c^2 \\]

### 微积分公式
1. **导数**：
   \\[ \\frac{d}{dx} (x^n) = nx^{n-1} \\]

2. **不定积分**：
   \\[ \\int x^n \, dx = \\frac{x^{n+1}}{n+1} + C \\]

3. **定积分**：
   \\[ \\int_a^b x^n \, dx = \\left[ \\frac{x^{n+1}}{n+1} \\right]_a^b \\]

### 线性代数公式
1. **矩阵乘法**：
   \\[ \\begin{pmatrix} a & b \\ c & d \\end{pmatrix} \\begin{pmatrix} e \\ f \\end{pmatrix} = \\begin{pmatrix} ae + bf \\ ce + df \\end{pmatrix} \\]

2. **行列式**：
   \\[ \\det \\begin{pmatrix} a & b \\ c & d \\end{pmatrix} = ad - bc \\]

### 概率公式
1. **条件概率**：
   \\[ P(A|B) = \\frac{P(A \\cap B)}{P(B)} \\]

2. **贝叶斯定理**：
   \\[ P(A|B) = \\frac{P(B|A)P(A)}{P(B)} \\]
`;

describe('KaTeX bracket syntax rendering', () => {
    it('renders AI style display math using \\[ delimiters', async () => {
        const html = await renderToString(
            h(StreamMarkdown, { content: aiResponse })
        );

        const displayCount = (html.match(/katex-display/g) || []).length;

        // We expect every display math block to be rendered by KaTeX.
        expect(displayCount).toBeGreaterThanOrEqual(12);
    });

    it('renders bracket math nested inside blockquotes and lists', async () => {
        const nestedContent = [
            '> 引用段落',
            '> \\[ e^{i\\pi} + 1 = 0 \\]',
            '>',
            '> 继续说明。',
            '',
            '- 列表项：',
            '    \\[ a^2 + b^2 = c^2 \\]',
            '',
            '结尾说明。',
        ].join('\n');

        const html = await renderToString(
            h(StreamMarkdown, { content: nestedContent })
        );

        const displayCount = (html.match(/katex-display/g) || []).length;
        expect(displayCount).toBe(2);
        expect(html).toContain('<blockquote');
        expect(html).not.toContain('\\\\[');
    });

    it('ignores bracket syntax inside fenced code blocks', async () => {
        const fencedContent = [
            'Plain code:',
            '```',
            '\\[shouldStay\\]',
            '```',
            '',
            '> ~~~',
            '> \\[stillStay\\]',
            '> ~~~',
            '>',
            '\\[ x^2 + y^2 = z^2 \\]',
        ].join('\n');

        const html = await renderToString(
            h(StreamMarkdown, { content: fencedContent })
        );

        const displayCount = (html.match(/katex-display/g) || []).length;
        expect(displayCount).toBe(1);
        expect(html).toContain('shouldStay');
        expect(html).toContain('stillStay');
    });
});
