const CANONICAL_ALIASES: Record<string, string> = {
    py: 'python',
    python3: 'python',
    shellscript: 'shell',
    shellsession: 'shell',
    sh: 'shell',
    zsh: 'shell',
    bash: 'bash',
    'markdown-vue': 'vue',
    'vue-directives': 'vue',
    'vue-interpolations': 'vue',
    'vue-sfc-style-variable-injection': 'vue',
    md: 'markdown',
    'html-derivative': 'html',
    ts: 'typescript',
    js: 'javascript',
    yml: 'yaml',
};

export const DEFAULT_CORE_LANGUAGE_IDS = [
    'typescript',
    'tsx',
    'javascript',
    'jsx',
    'json',
    'bash',
    'shell',
    'python',
    'diff',
    'markdown',
    'vue',
    'html',
    'css',
    'go',
    'rust',
    'yaml',
];

export const normalizeLang = (lang: string): string =>
    lang.trim().toLowerCase().replace(/^language-/, '');

export const canonicalize = (lang: string): string => {
    const key = normalizeLang(lang);
    if (!key) return key;
    return CANONICAL_ALIASES[key] ?? key;
};

export const normalizeList = (langs: string[] = []): string[] => {
    return Array.from(new Set(langs.map(canonicalize).filter(Boolean))).sort();
};
