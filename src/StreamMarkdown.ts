import { defineComponent, h } from 'vue';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import type { Element, Root, Text } from 'hast';
import CodeBlock from './components/CodeBlock';
import MermaidBlock from './components/MermaidBlock';
import { parseMarkdownIntoBlocks } from './parse-blocks';
import { fixIncompleteMarkdown as fixMarkdown } from './fix-incomplete-markdown';
import 'katex/dist/katex.min.css';

export const StreamMarkdown = defineComponent({
  name: 'StreamMarkdown',
  props: {
    content: { type: String, default: '' },
    allowedImagePrefixes: { type: Array as () => string[], default: () => ['https://', 'http://'] },
    allowedLinkPrefixes: { type: Array as () => string[], default: () => ['https://', 'http://'] },
    parseIncomplete: { type: Boolean, default: true },
  },
  setup(props) {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, { allowDangerousHtml: false })
      .use(rehypeKatex);

    const isAllowed = (url: string, prefixes: string[]) => prefixes.some((p) => url.startsWith(p));

    const renderChildren = (nodes: any[], parent?: string): any[] =>
      nodes.map((n) => renderNode(n, parent)).filter(Boolean);

    function extractText(n: any): string {
      if (n.type === 'text') return n.value;
      if (n.children) return n.children.map(extractText).join('');
      return '';
    }

    const renderNode = (node: any, parentTag?: string): any => {
      if (!node) return null;
      if (node.type === 'text') return (node as Text).value;
      if (node.type !== 'element') return null;
      const el = node as Element;
      const nodeProps: any = { ...(el.properties || {}) };
      const children = renderChildren(el.children || [], el.tagName);
      const tag = el.tagName;

      // security filters
      if (tag === 'a') {
        const href = String(nodeProps.href || '');
        if (!isAllowed(href, props.allowedLinkPrefixes)) {
          return children;
        }
        nodeProps.target = '_blank';
        nodeProps.rel = 'noreferrer';
      }
      if (tag === 'img') {
        const src = String(nodeProps.src || '');
        if (!isAllowed(src, props.allowedImagePrefixes)) return null;
      }

      // code or mermaid blocks
      if (tag === 'pre' && el.children && el.children[0] && el.children[0].tagName === 'code') {
        const codeEl = el.children[0] as Element;
        const code = extractText(codeEl);
        const className = (codeEl.properties?.className || []) as string[];
        const langClass = className.find((c) => c.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : '';
        if (lang === 'mermaid') {
          return h(MermaidBlock, { code });
        }
        return h(CodeBlock, { code, language: lang });
      }

      // inline code styling
      if (tag === 'code' && parentTag !== 'pre') {
        const classList = new Set<string>((nodeProps.className as string[]) || []);
        classList.add('bg-muted px-1.5 py-0.5 font-mono text-sm');
        nodeProps.class = Array.from(classList).join(' ');
        delete nodeProps.className;
        return h(tag, nodeProps, children);
      }

      // table wrapper and cell styles
      if (tag === 'table') {
        const classList = new Set<string>((nodeProps.className as string[]) || []);
        classList.add('w-full text-sm');
        nodeProps.class = Array.from(classList).join(' ');
        delete nodeProps.className;
        const table = h('table', nodeProps, children);
        return h('div', { class: 'overflow-x-auto' }, [table]);
      }
      if (tag === 'th' || tag === 'td') {
        const classList = new Set<string>((nodeProps.className as string[]) || []);
        classList.add('border px-2 py-1');
        nodeProps.class = Array.from(classList).join(' ');
        delete nodeProps.className;
        return h(tag, nodeProps, children);
      }

      if (tag === 'hr') {
        const classList = new Set<string>((nodeProps.className as string[]) || []);
        classList.add('my-6 border-border');
        nodeProps.class = Array.from(classList).join(' ');
        delete nodeProps.className;
        return h(tag, nodeProps);
      }

      // tailwind styling
      const classList = new Set<string>((nodeProps.className as string[]) || []);
      const map: Record<string, string> = {
        h1: 'text-3xl font-bold',
        h2: 'text-2xl font-bold',
        h3: 'text-xl font-semibold',
        ul: 'list-disc pl-6',
        ol: 'list-decimal pl-6',
        blockquote: 'border-l-4 pl-4 italic',
      };
      if (map[tag]) classList.add(map[tag]);
      if (classList.size) nodeProps.class = Array.from(classList).join(' ');
      delete nodeProps.className;

      return h(tag, nodeProps, children);
    };

    return () => {
      const markdown = props.parseIncomplete ? fixMarkdown(props.content) : props.content;
      const blocks = parseMarkdownIntoBlocks(markdown).map((b) => (props.parseIncomplete ? fixMarkdown(b.trim()) : b));
      const vnodes = blocks.flatMap((block) => {
        const tree = processor.runSync(processor.parse(block)) as Root;
        return renderChildren(tree.children as any[]);
      });
      return h('div', { class: 'vuedown space-y-4' }, vnodes);
    };
  },
});

export default StreamMarkdown;
