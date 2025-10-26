import {
    createHighlighter,
    type Highlighter,
    bundledLanguagesInfo,
} from 'shiki';

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

export type UseShikiHighlighterOptions = {
    disclude?: string[];
};

let preferredDisclude: string[] = [];
let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
let configuredKey: string | null = null;
let warnedAboutConfigMismatch = false;

const normalizeLang = (lang: string): string =>
    lang.trim().toLowerCase().replace(/^language-/, '');

type AliasMap = Map<string, string>;
let aliasMap: AliasMap | null = null;

const getAliasMap = (): AliasMap => {
    if (aliasMap) return aliasMap;
    aliasMap = new Map();
    bundledLanguagesInfo.forEach((info: any) => {
        const canonical = normalizeLang(info.id || '');
        if (!canonical) return;
        aliasMap!.set(canonical, canonical);
        const aliases = info.aliases || [];
        aliases.forEach((alias: string) => {
            const key = normalizeLang(alias);
            if (key) {
                aliasMap!.set(key, canonical);
            }
        });
    });
    return aliasMap;
};

const canonicalize = (lang: string): string => {
    const key = normalizeLang(lang);
    if (!key) return key;
    return getAliasMap().get(key) ?? key;
};

const normalizeList = (langs: string[] = []): string[] => {
    return Array.from(
        new Set(langs.map(canonicalize).filter(Boolean))
    ).sort();
};

const computeLangs = (disclude: string[]): string[] => {
    if (!disclude.length) return [...CORE_LANGS];
    const blocklist = new Set(disclude);
    return CORE_LANGS.filter((lang) => {
        const canonical = canonicalize(lang);
        return !blocklist.has(canonical);
    });
};

export function setDefaultShikiDisclude(langs: string[] = []): void {
    preferredDisclude = normalizeList(langs);
}

export function __resetHighlighterForTests(): void {
    preferredDisclude = [];
    highlighter = null;
    highlighterPromise = null;
    configuredKey = null;
    warnedAboutConfigMismatch = false;
}

export async function useShikiHighlighter(
    options: UseShikiHighlighterOptions = {}
): Promise<Highlighter> {
    const normalized = normalizeList(
        options.disclude ?? preferredDisclude ?? []
    );
    const key = normalized.join(',');
    if (!highlighterPromise) {
        configuredKey = key;
        highlighterPromise = createHighlighter({
            themes: ['github-light', 'github-dark'],
            langs: computeLangs(normalized),
        }).then((instance) => {
            highlighter = instance;
            return instance;
        });
    } else if (
        configuredKey !== key &&
        normalized.length &&
        !warnedAboutConfigMismatch
    ) {
        console.warn(
            '[streamdown-vue] shikiDisclude changed after the highlighter initialized. Reload to apply new exclusions.'
        );
        warnedAboutConfigMismatch = true;
    }
    return await highlighterPromise;
}
