import { describe, it, expect, beforeEach } from 'bun:test';
import {
    useShikiHighlighter,
    setDefaultShikiDisclude,
    __resetHighlighterForTests,
} from '../src/use-shiki-highlighter';

describe('shiki language exclusions', () => {
    beforeEach(() => {
        __resetHighlighterForTests();
        setDefaultShikiDisclude([]);
    });

    it('removes globally excluded languages from the preload list', async () => {
        setDefaultShikiDisclude(['rust', 'python']);
        const highlighter = await useShikiHighlighter();
        const loaded = highlighter.getLoadedLanguages();
        expect(loaded).not.toContain('rust');
        expect(loaded).not.toContain('python');
        expect(loaded).not.toContain('py');
        expect(loaded).toContain('ts');
    });

    it('honors per-call shikiDisclude overrides', async () => {
        const highlighter = await useShikiHighlighter({
            disclude: ['vue'],
        });
        const loaded = highlighter.getLoadedLanguages();
        expect(loaded).not.toContain('vue');
        expect(loaded).toContain('ts');
    });
});
