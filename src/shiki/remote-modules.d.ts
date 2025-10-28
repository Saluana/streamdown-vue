import type { ShikiCdnModuleGlob } from './cdn';

declare module 'https://esm.sh/@shikijs/langs@3.12.1/es2022/*.mjs' {
    const mod: any;
    export default mod;
}

type __shikiCdnGlobAssert =
    ShikiCdnModuleGlob extends 'https://esm.sh/@shikijs/langs@3.12.1/es2022/*.mjs'
        ? true
        : never;
