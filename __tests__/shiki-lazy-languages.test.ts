import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { LanguageRegistration } from 'shiki/core';
import {
    clearRegisteredShikiLanguages,
    isLazyShikiLanguage,
    registerShikiLanguages,
    unregisterShikiLanguage,
} from '../src/shiki/registry';
import {
    __resetHighlighterForTests,
    loadRegisteredShikiLanguage,
    useShikiHighlighter,
} from '../src/use-shiki-highlighter';

const grammar = (name: string): LanguageRegistration[] => [
    { name, scopeName: `source.${name}`, patterns: [], repository: {} },
];

describe('lazy Shiki languages', () => {
    afterEach(() => {
        clearRegisteredShikiLanguages();
        __resetHighlighterForTests();
    });

    it('eager loaders run at highlighter creation, lazy ones only on first use', async () => {
        const eager = mock(async () => grammar('zzeager'));
        const lazy = mock(async () => grammar('zzlazy'));
        registerShikiLanguages([
            { id: 'zzeager', loader: eager },
            { id: 'zzlazy', loader: lazy, lazy: true, aliases: ['zzl'] },
        ]);

        const highlighter = await useShikiHighlighter();
        expect(eager).toHaveBeenCalledTimes(1);
        expect(lazy).toHaveBeenCalledTimes(0);
        expect(highlighter.getLoadedLanguages()).toContain('zzeager');
        expect(highlighter.getLoadedLanguages()).not.toContain('zzlazy');

        // The same path CodeBlock takes for a fence whose language is not loaded yet.
        expect(await loadRegisteredShikiLanguage('zzl')).toBe(true);
        expect(lazy).toHaveBeenCalledTimes(1);
        expect(highlighter.getLoadedLanguages()).toContain('zzlazy');
    });

    it('isLazyShikiLanguage follows aliases and registration changes', () => {
        registerShikiLanguages([
            { id: 'zzeager', loader: async () => grammar('zzeager') },
            { id: 'zzlazy', loader: async () => grammar('zzlazy'), lazy: true, aliases: ['zzl'] },
        ]);
        expect(isLazyShikiLanguage('zzlazy')).toBe(true);
        expect(isLazyShikiLanguage('zzl')).toBe(true);
        expect(isLazyShikiLanguage('zzeager')).toBe(false);
        expect(isLazyShikiLanguage('unknown')).toBe(false);

        // Re-registering without the flag makes the language eager again.
        registerShikiLanguages([{ id: 'zzlazy', loader: async () => grammar('zzlazy') }]);
        expect(isLazyShikiLanguage('zzlazy')).toBe(false);

        registerShikiLanguages([{ id: 'zzlazy', loader: async () => grammar('zzlazy'), lazy: true }]);
        unregisterShikiLanguage('zzlazy');
        expect(isLazyShikiLanguage('zzlazy')).toBe(false);

        registerShikiLanguages([{ id: 'zzlazy', loader: async () => grammar('zzlazy'), lazy: true }]);
        clearRegisteredShikiLanguages();
        expect(isLazyShikiLanguage('zzlazy')).toBe(false);
    });
});
