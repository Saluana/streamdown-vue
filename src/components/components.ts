import { h } from 'vue';

export type ComponentMap = Record<string, any>;

const mergeClass = (existing?: any, extra?: string) => {
  const cls: string[] = [];
  if (Array.isArray(existing)) cls.push(...existing);
  else if (typeof existing === 'string') cls.push(existing);
  if (extra) cls.push(extra);
  return cls.join(' ').trim();
};

const wrap = (tag: string, baseClass = '', dataAttr?: string) => {
  return (props: any, { slots }: any) => {
    const className = mergeClass(props.class || props.className, baseClass);
    const attrs = { ...props, class: className || undefined } as any;
    if (dataAttr) attrs['data-streamdown'] = dataAttr;
    delete attrs.className;
    return h(tag, attrs, slots.default ? slots.default() : []);
  };
};

export const defaultComponents: ComponentMap = {
  p: wrap('p', 'mb-2', 'p'),
  a: (props: any, { slots }: any) => {
    const className = mergeClass(props.class || props.className, 'underline text-blue-600');
    const attrs: any = { ...props, class: className || undefined, 'data-streamdown': 'a', target: '_blank', rel: 'noreferrer' };
    delete attrs.className;
    return h('a', attrs, slots.default ? slots.default() : []);
  },
  code: wrap('code', 'bg-muted px-1.5 py-0.5 font-mono text-sm', 'inline-code'),
  ul: wrap('ul', 'list-disc pl-6', 'ul'),
  ol: wrap('ol', 'list-decimal pl-6', 'ol'),
  li: wrap('li', '', 'li'),
  hr: wrap('hr', 'my-6 border-border', 'hr'),
  strong: wrap('strong', '', 'strong'),
  em: wrap('em', '', 'em'),
  h1: wrap('h1', 'text-3xl font-bold', 'h1'),
  h2: wrap('h2', 'text-2xl font-bold', 'h2'),
  h3: wrap('h3', 'text-xl font-semibold', 'h3'),
  h4: wrap('h4', 'text-lg font-semibold', 'h4'),
  h5: wrap('h5', 'font-semibold', 'h5'),
  h6: wrap('h6', 'font-semibold', 'h6'),
  blockquote: wrap('blockquote', 'border-l-4 pl-4 italic', 'blockquote'),
  table: (props: any, { slots }: any) => {
    const className = mergeClass(props.class || props.className, 'w-full text-sm');
    const attrs: any = { ...props, class: className || undefined, 'data-streamdown': 'table' };
    delete attrs.className;
    const table = h('table', attrs, slots.default ? slots.default() : []);
    return h('div', { class: 'overflow-x-auto', 'data-streamdown': 'table-wrapper' }, [table]);
  },
  thead: wrap('thead', '', 'thead'),
  tbody: wrap('tbody', '', 'tbody'),
  tr: wrap('tr', '', 'tr'),
  th: wrap('th', 'border px-2 py-1', 'th'),
  td: wrap('td', 'border px-2 py-1', 'td'),
  img: (props: any) => {
    const className = mergeClass(props.class || props.className, '');
    const attrs: any = { ...props, class: className || undefined, 'data-streamdown': 'img' };
    delete attrs.className;
    return h('img', attrs);
  },
};

export default defaultComponents;
