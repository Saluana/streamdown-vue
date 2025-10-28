import { createCdnLanguageLoader } from './cdn';
import { registerShikiLanguages, type ShikiLanguageConfig } from './registry';

const DEFAULT_LANGUAGE_CONFIGS: ShikiLanguageConfig[] = [
    {
        id: 'cpp',
        aliases: ['c++'],
        loader: createCdnLanguageLoader('cpp'),
    },
    {
        id: 'java',
        aliases: ['java'],
        loader: createCdnLanguageLoader('java'),
    },
    {
        id: 'c',
        loader: createCdnLanguageLoader('c'),
    },
    {
        id: 'csharp',
        aliases: ['cs', 'c#'],
        loader: createCdnLanguageLoader('csharp'),
    },
    {
        id: 'php',
        loader: createCdnLanguageLoader('php'),
    },
    {
        id: 'ruby',
        loader: createCdnLanguageLoader('ruby'),
    },
    {
        id: 'kotlin',
        loader: createCdnLanguageLoader('kotlin'),
    },
    {
        id: 'swift',
        loader: createCdnLanguageLoader('swift'),
    },
    {
        id: 'sql',
        loader: createCdnLanguageLoader('sql'),
    },
    {
        id: 'typescript',
        aliases: ['ts'],
        loader: () => import('@shikijs/langs/typescript'),
    },
    {
        id: 'tsx',
        loader: () => import('@shikijs/langs/tsx'),
    },
    {
        id: 'javascript',
        aliases: ['js'],
        loader: () => import('@shikijs/langs/javascript'),
    },
    {
        id: 'jsx',
        loader: () => import('@shikijs/langs/jsx'),
    },
    {
        id: 'json',
        loader: () => import('@shikijs/langs/json'),
    },
    {
        id: 'bash',
        loader: () => import('@shikijs/langs/bash'),
    },
    {
        id: 'shell',
        aliases: ['shellscript', 'shellsession', 'sh', 'zsh'],
        loader: () => import('@shikijs/langs/shellscript'),
    },
    {
        id: 'python',
        aliases: ['py'],
        loader: () => import('@shikijs/langs/python'),
    },
    {
        id: 'diff',
        loader: () => import('@shikijs/langs/diff'),
    },
    {
        id: 'markdown',
        aliases: ['md'],
        loader: () => import('@shikijs/langs/markdown'),
    },
    {
        id: 'vue',
        loader: () => import('@shikijs/langs/vue'),
    },
    {
        id: 'html',
        loader: () => import('@shikijs/langs/html'),
    },
    {
        id: 'css',
        loader: () => import('@shikijs/langs/css'),
    },
    {
        id: 'go',
        loader: () => import('@shikijs/langs/go'),
    },
    {
        id: 'rust',
        loader: () => import('@shikijs/langs/rust'),
    },
    {
        id: 'yaml',
        aliases: ['yml'],
        loader: () => import('@shikijs/langs/yaml'),
    },
];

let defaultsRegistered = false;

export function registerDefaultShikiLanguages(): void {
    if (defaultsRegistered) return;
    defaultsRegistered = true;
    registerShikiLanguages(DEFAULT_LANGUAGE_CONFIGS.slice());
}
