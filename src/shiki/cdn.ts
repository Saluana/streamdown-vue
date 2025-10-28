import type { LanguageInput } from 'shiki/core';

export const SHIKI_LANGS_VERSION = '3.12.1' as const;

const SHIKI_CDN_BASE = `https://esm.sh/@shikijs/langs@${SHIKI_LANGS_VERSION}/es2022/` as const;
export const SHIKI_CDN_MODULE_GLOB = `${SHIKI_CDN_BASE}*.mjs` as const;
export type ShikiCdnModuleGlob = typeof SHIKI_CDN_MODULE_GLOB;

const REMOTE_LOADER_FLAG = Symbol.for('streamdown.vue.shikiRemote');

const markRemoteLoader = (loader: LanguageInput): LanguageInput => {
    if (typeof loader === 'function') {
        (loader as any)[REMOTE_LOADER_FLAG] = true;
    }
    return loader;
};

export const isRemoteLanguageLoader = (loader: LanguageInput): boolean => {
    return (
        typeof loader === 'function' &&
        Boolean((loader as any)?.[REMOTE_LOADER_FLAG])
    );
};

export const createCdnLanguageLoader = (
    specifier: string
): LanguageInput => {
    const local = () =>
        import(
            /* @vite-ignore */
            `@shikijs/langs/${specifier}`
        );
    const remote = () =>
        import(
            /* webpackIgnore: true */
            /* @vite-ignore */
            `${SHIKI_CDN_BASE}${specifier}.mjs`
        );
    const loader: LanguageInput = async () => {
        if (typeof window === 'undefined') {
            return local();
        }
        try {
            return await remote();
        } catch {
            return local();
        }
    };
    return markRemoteLoader(loader);
};
