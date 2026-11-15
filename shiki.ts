// DOM-free entry for browser workers and server-side highlighting.
export {
    useShikiHighlighter,
    loadRegisteredShikiLanguage,
} from './src/use-shiki-highlighter';
export * from './src/shiki/registry';
export { registerDefaultShikiLanguages } from './src/shiki/register-default-languages';
export { createStreamingHighlighter } from './src/shiki/streaming';
export type { ShikiThemeConfig, CodeHighlightInput } from './src/types';
