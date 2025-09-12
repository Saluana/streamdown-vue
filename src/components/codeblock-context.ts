// Shared symbols & types for CodeBlock related provide/inject APIs.
import type { InjectionKey } from 'vue';

export interface ProvidedCodeBlockMeta {
    code: string;
    language: string;
}

export const CODE_BLOCK_META_KEY: InjectionKey<ProvidedCodeBlockMeta> =
    Symbol('code-block-meta');

// Global (app-level) extension actions: components or render functions.
// Each entry can be a Vue component (object/function) or a function returning a VNode array.
export type CodeBlockAction = any; // kept broad intentionally for user flexibility
export const GLOBAL_CODE_BLOCK_ACTIONS: InjectionKey<CodeBlockAction[]> =
    Symbol('global-code-block-actions');
