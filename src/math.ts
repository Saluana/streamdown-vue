import type { Plugin } from 'unified';

// KaTeX is large (~250 KB of JavaScript before compression) and most streamed
// content contains no math, so `rehype-katex` is loaded the first time math
// appears (or when an app calls `preloadMath()`), not with the renderer.

type RehypeKatex = Plugin<any[], any>;

let rehypeKatex: RehypeKatex | null = null;
let loading: Promise<void> | null = null;

/** The loaded `rehype-katex` plugin, or null until `preloadMath()` settles. */
export function getRehypeKatex(): RehypeKatex | null {
    return rehypeKatex;
}

/**
 * Load KaTeX math rendering ahead of time.
 *
 * Math renders on demand by default: until KaTeX has loaded, math shows as its
 * TeX source and switches to rendered output once it arrives. Await this
 * before rendering when math must be rendered on the first pass, such as
 * server-side rendering (call it on the server and before the client
 * hydrates, so both render the same markup). Safe to call repeatedly; a failed
 * load can be retried.
 */
export function preloadMath(): Promise<void> {
    loading ??= import('rehype-katex').then(
        (module: any) => {
            rehypeKatex = (module?.default ?? module) as RehypeKatex;
        },
        (error) => {
            loading = null;
            throw error;
        }
    );
    return loading;
}

/** Test-only: forget the loaded plugin so on-demand loading can be exercised. */
export function resetMathForTests(): void {
    rehypeKatex = null;
    loading = null;
}
