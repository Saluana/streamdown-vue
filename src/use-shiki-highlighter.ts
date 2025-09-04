import { getSingletonHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

// Core language set we eagerly load so that most common fences highlight without
// per-language network round trips in consuming apps (especially SSR hydration).
const CORE_LANGS = [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'bash',
    'sh',
    'shell',
    'python',
    'py',
    'diff',
    'markdown',
    'md',
    'vue',
    'html',
    'css',
    'go',
    'rust',
];

export async function useShikiHighlighter(): Promise<Highlighter> {
    if (!highlighter) {
        highlighter = await getSingletonHighlighter({
            themes: ['github-light', 'github-dark'],
            langs: CORE_LANGS,
        });
    }
    return highlighter;
}
