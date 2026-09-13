import type { LanguageInput } from 'shiki/core';
import { canonicalize } from './lang-utils';

export type ShikiLanguageConfig = {
    id: string;
    loader: LanguageInput;
    aliases?: string[];
    /**
     * Load this grammar on demand instead of at highlighter creation.
     *
     * Lazy grammars are excluded from the initial `createHighlighterCore` call and
     * are loaded by `CodeBlock` (via `loadRegisteredShikiLanguage`) the first time a
     * fence with this language shows up — one chunk per language, nothing is fetched
     * for languages that never appear. Pair it with a dynamic-import loader:
     * `{ id: 'cpp', lazy: true, loader: () => import('@shikijs/langs/cpp') }`.
     */
    lazy?: boolean;
};

const registry = new Map<string, LanguageInput>();
const aliasToCanonical = new Map<string, string>();
const lazyIds = new Set<string>();

const rememberAlias = (alias: string, canonical: string) => {
    const normalized = canonicalize(alias);
    if (!normalized) return;
    aliasToCanonical.set(normalized, canonical);
};

const ensureCanonical = (id: string): string | undefined => {
    const normalized = canonicalize(id);
    if (!normalized) return undefined;
    if (registry.has(normalized)) return normalized;
    const mapped = aliasToCanonical.get(normalized);
    if (mapped && registry.has(mapped)) return mapped;
    return undefined;
};

const removeAliasesFor = (canonical: string): void => {
    for (const [alias, target] of Array.from(aliasToCanonical.entries())) {
        if (target === canonical || alias === canonical) {
            aliasToCanonical.delete(alias);
        }
    }
};

export function registerShikiLanguage(config: ShikiLanguageConfig): void {
    const canonicalId = canonicalize(config.id);
    if (!canonicalId) return;
    registry.set(canonicalId, config.loader);
    if (config.lazy) {
        lazyIds.add(canonicalId);
    } else {
        lazyIds.delete(canonicalId);
    }
    rememberAlias(canonicalId, canonicalId);
    (config.aliases ?? []).forEach((alias) => rememberAlias(alias, canonicalId));
}

export function registerShikiLanguages(
    configs: ShikiLanguageConfig[]
): void {
    configs.forEach(registerShikiLanguage);
}

export function unregisterShikiLanguage(id: string): void {
    const canonical = ensureCanonical(id);
    if (!canonical) {
        const normalized = canonicalize(id);
        if (normalized) aliasToCanonical.delete(normalized);
        return;
    }
    registry.delete(canonical);
    lazyIds.delete(canonical);
    removeAliasesFor(canonical);
}

export function excludeShikiLanguages(ids: string[]): void {
    ids.forEach(unregisterShikiLanguage);
}

export function resolveLanguageInputs(ids: string[]): {
    inputs: LanguageInput[];
    missing: string[];
    resolved: string[];
} {
    const seen = new Set<string>();
    const inputs: LanguageInput[] = [];
    const missing: string[] = [];
    const resolved: string[] = [];
    ids.forEach((id) => {
        const canonical = ensureCanonical(id);
        if (!canonical) {
            missing.push(canonicalize(id) || id);
            return;
        }
        if (seen.has(canonical)) return;
        const loader = registry.get(canonical);
        if (!loader) {
            missing.push(canonical);
            return;
        }
        seen.add(canonical);
        resolved.push(canonical);
        inputs.push(loader);
    });
    return { inputs, missing, resolved };
}

export function getRegisteredLanguageIds(): string[] {
    return Array.from(registry.keys()).sort();
}

export function hasRegisteredLanguages(): boolean {
    return registry.size > 0;
}

/** `true` when the language (canonical id or alias) was registered with `lazy: true`. */
export function isLazyShikiLanguage(id: string): boolean {
    const canonical = ensureCanonical(id);
    return canonical ? lazyIds.has(canonical) : false;
}

export function clearRegisteredShikiLanguages(): void {
    registry.clear();
    aliasToCanonical.clear();
    lazyIds.clear();
}
