import {
    hastToHtml,
    isSpecialLang,
    type GrammarState,
    type HighlighterCore,
} from 'shiki/core';
import type { Element, ElementContent, Root } from 'hast';
import type { CodeHighlightInput } from '../types';

/** A single code block's tokenizer. Release the function when its block unmounts. */
export function createStreamingHighlighter(highlighter: HighlighterCore) {
    let source = '';
    let completeLength = 0;
    let completeNodes: ElementContent[] = [];
    let state: GrammarState | undefined;
    let context: unknown[] = [];
    let previousHtml = '';
    const codeNode = (tree: Root) =>
        (tree.children[0] as Element).children[0] as Element;

    return ({ code, language, theme }: CodeHighlightInput): string => {
        // ANSI has its own escape-state machine rather than TextMate grammar state.
        const options =
            typeof theme === 'string' ? { theme } : { themes: theme };
        if (language === 'ansi')
            return highlighter.codeToHtml(code, { lang: language, ...options });
        const nextContext = [
            language,
            isSpecialLang(language) ? null : highlighter.getLanguage(language),
            ...Object.values(options.themes ?? { single: options.theme }).map(
                (name) => highlighter.getTheme(name!),
            ),
        ];
        const next = code.replace(/\r\n/g, '\n');
        if (
            !next.startsWith(source) ||
            nextContext.length !== context.length ||
            nextContext.some((value, index) => value !== context[index])
        ) {
            source = '';
            completeLength = 0;
            completeNodes = [];
            state = undefined;
        } else if (next === source && previousHtml) {
            return previousHtml;
        }
        context = nextContext;
        const boundary = next.lastIndexOf('\n') + 1;
        if (boundary > completeLength) {
            // Exclude the final newline: its empty line belongs to the mutable tail.
            const tree = highlighter.codeToHast(
                next.slice(completeLength, boundary - 1),
                {
                    lang: language,
                    ...options,
                    grammarState: state,
                },
            );
            if (completeNodes.length)
                completeNodes.push({ type: 'text', value: '\n' });
            completeNodes.push(...codeNode(tree).children);
            state = highlighter.getLastGrammarState(tree);
            completeLength = boundary;
        }
        const tree = highlighter.codeToHast(next.slice(completeLength), {
            lang: language,
            ...options,
            grammarState: state,
        });
        const tail = codeNode(tree);
        tail.children = completeNodes.length
            ? [
                  ...completeNodes,
                  { type: 'text', value: '\n' },
                  ...tail.children,
              ]
            : tail.children;
        source = next;
        previousHtml = hastToHtml(tree);
        return previousHtml;
    };
}
