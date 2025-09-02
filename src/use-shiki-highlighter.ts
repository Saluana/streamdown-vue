import { getSingletonHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export async function useShikiHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await getSingletonHighlighter({ themes: ['github-light', 'github-dark'] });
  }
  return highlighter;
}
