import {
    createHighlighterCore,
    type HighlighterCore,
    type LanguageInput,
    type ThemeInput,
} from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubLight from '@shikijs/themes/github-light';
import githubDark from '@shikijs/themes/github-dark';
import {
    getRegisteredLanguageIds,
    hasRegisteredLanguages,
    resolveLanguageInputs,
} from './shiki/registry';
import { isRemoteLanguageLoader } from './shiki/cdn';

let highlighter: HighlighterCore | null = null;
let highlighterPromise: Promise<HighlighterCore> | null = null;

const themes: ThemeInput[] = [githubLight, githubDark];

let regexEngine: ReturnType<typeof createJavaScriptRegexEngine> | null = null;
const ensureEngine = () => {
    if (!regexEngine) {
        regexEngine = createJavaScriptRegexEngine();
    }
    return regexEngine;
};

const prepareLanguageInputs = (): LanguageInput[] => {
    if (!hasRegisteredLanguages()) {
        console.warn(
            '[streamdown-vue] No Shiki languages are registered. Code blocks will render without syntax highlighting.'
        );
        return [];
    }

    const ids = getRegisteredLanguageIds();
    const { inputs, missing } = resolveLanguageInputs(ids);

    if (missing.length) {
        console.warn(
            `[streamdown-vue] Some requested Shiki languages are not registered: ${missing.join(
                ', '
            )}`
        );
    }

    return inputs.filter((input) => !isRemoteLanguageLoader(input));
};

export function __resetHighlighterForTests(): void {
    highlighter = null;
    highlighterPromise = null;
}

export async function loadRegisteredShikiLanguage(
    lang: string
): Promise<boolean> {
    if (!highlighter) return false;
    const { inputs } = resolveLanguageInputs([lang]);
    if (!inputs.length) return false;
    await highlighter.loadLanguage(...inputs);
    return true;
}

export async function useShikiHighlighter(): Promise<HighlighterCore> {
    if (!highlighterPromise) {
        const langs = prepareLanguageInputs();
        highlighterPromise = createHighlighterCore({
            themes,
            langs,
            engine: ensureEngine(),
        }).then((instance) => {
            highlighter = instance;
            return instance;
        });
    }
    return await highlighterPromise;
}
