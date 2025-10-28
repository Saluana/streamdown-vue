# Shiki Language Configuration Guide# Shiki Language Bundling Guide

This guide explains how to control which syntax highlighting grammars are loaded in your application when using `streamdown-vue`.Streamdown Vue lets you control exactly which Shiki grammars are loaded at build or run time. The registry-backed helpers introduced in this release keep the default experience intact while giving power users explicit switches.

For a complete list of available languages, see the [Shiki Languages Reference](https://shiki.style/languages).This guide covers:

---1. Default entry (`streamdown-vue`) – curated set, plus additive helpers.

2. Core entry (`streamdown-vue/core`) – starts empty for fully custom bundles.

## Table of Contents3. Registry utilities (`registerShikiLanguage`, `excludeShikiLanguages`, `clearRegisteredShikiLanguages`).

4. CDN loader patterns.

1. [Overview](#overview)5. Troubleshooting / FAQs.

1. [Default Entry (`streamdown-vue`)](#default-entry)

1. [Core Entry (`streamdown-vue/core`)](#core-entry)---

1. [Registry API Reference](#registry-api-reference)

1. [CDN Loaders Explained](#cdn-loaders-explained)## 1. Default Entry (`streamdown-vue`)

1. [Common Patterns](#common-patterns)

1. [Troubleshooting](#troubleshooting)```ts

// main.ts

---import { StreamMarkdown } from 'streamdown-vue';

````

## Overview

Importing from the default entry automatically calls `registerDefaultShikiLanguages()`. The curated set includes:

`streamdown-vue` uses [Shiki](https://shiki.style) for syntax highlighting. The library provides two entry points:

**Bundled Languages:**

- **`streamdown-vue`** – Default entry with a curated set of languages pre-registered- TypeScript / TSX

- **`streamdown-vue/core`** – Empty registry for complete control over bundle size- JavaScript / JSX

- JSON

Both entries use a **registry system** that lets you:- Bash + generic shell

- Add languages before or after initialization- Python

- Remove unwanted languages from the default set- Diff

- Use CDN loaders to minimize bundle size- Markdown / Vue SFC

- Override language loaders with custom implementations- HTML

- CSS

---- Go

- Rust

## Default Entry- YAML



### What's Included**CDN Languages (with local fallback):**

- C++

When you import from `streamdown-vue`, the following languages are automatically registered:- Java

- C

#### Bundled Languages (included in your build)- C# (csharp)

```- PHP

bash, css, diff, go, html, javascript, jsx, json, - Ruby

markdown, python, rust, shell, tsx, typescript, vue, yaml- Kotlin

```- Swift

- SQL

#### CDN Languages (loaded on-demand from esm.sh)

```> **Note:** CDN languages are loaded from `https://esm.sh/@shikijs/langs@3.12.1/es2022/` on demand to keep the default bundle light. During SSR or if the CDN fails, these languages automatically fall back to local imports from `@shikijs/langs`. However, CDN languages are **not loaded into the highlighter during initialization** - they are only loaded on-demand when a matching code fence is encountered via `loadRegisteredShikiLanguage()`.

c, cpp, csharp, java, kotlin, php, ruby, sql, swift### Extending the defaults

````

Add extra grammars before your first call to `useShikiHighlighter()`:

> **Note:** CDN languages are NOT bundled into your application. They're loaded from `https://esm.sh/@shikijs/langs@3.12.1/es2022/` when first encountered in a code fence. During SSR or if the CDN fails, they automatically fall back to local imports from `@shikijs/langs`.

`````ts

### Aliasesimport { registerShikiLanguage } from 'streamdown-vue';



The following aliases are also registered:registerShikiLanguage({

- `ts` → `typescript`    id: 'cpp',

- `js` → `javascript`    loader: () => import('@shikijs/langs/cpp'),

- `py` → `python`});

- `md` → `markdown````

- `yml` → `yaml`

- `c++` → `cpp`### Trimming the defaults

- `cs`, `c#` → `csharp`

- `sh`, `zsh`, `shellscript`, `shellsession` → `shell`Remove a grammar after the defaults register:



### Basic Usage```ts

import { excludeShikiLanguages } from 'streamdown-vue';

```ts

// main.tsexcludeShikiLanguages(['rust']);

import { StreamMarkdown } from 'streamdown-vue';```



// The defaults are already registered!### Resetting the registry

// Just use the component

```Start from scratch without switching entry points:



### Adding Languages to the Defaults```ts

import {

```ts    clearRegisteredShikiLanguages,

import { StreamMarkdown, registerShikiLanguage } from 'streamdown-vue';    registerShikiLanguages,

} from 'streamdown-vue';

// Add Rust (wait, it's already included!)

// Add a language that's NOT in the defaults:clearRegisteredShikiLanguages();

registerShikiLanguage({registerShikiLanguages([

    id: 'elixir',    { id: 'javascript', loader: () => import('@shikijs/langs/javascript') },

    loader: () => import('@shikijs/langs/elixir'),    { id: 'markdown', loader: () => import('@shikijs/langs/markdown') },

});]);

`````

// Add with aliases

registerShikiLanguage({---

    id: 'dockerfile',

    aliases: ['docker'],## 2. Core Entry (`streamdown-vue/core`)

    loader: () => import('@shikijs/langs/dockerfile'),

});`streamdown-vue/core` exports the same public API but skips the default registry. It is ideal for minimal bundles:

````

```ts

### Removing Languages from the Defaultsimport {

    StreamMarkdown,

```ts    registerShikiLanguages,

import { excludeShikiLanguages } from 'streamdown-vue';} from 'streamdown-vue/core';



// Remove languages you don't needregisterShikiLanguages([

excludeShikiLanguages(['rust', 'go', 'java']);    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },

```    { id: 'json', loader: () => import('@shikijs/langs/json') },

]);

### Completely Replacing the Defaults```



```tsAnything not registered renders as plain `<pre><code>` (with a dev warning).

import {

    clearRegisteredShikiLanguages,---

    registerShikiLanguages

} from 'streamdown-vue';## 3. Registry Utility Reference



// Start fresh| Helper | Description |

clearRegisteredShikiLanguages();| --- | --- |

| `registerDefaultShikiLanguages()` | Populates the curated defaults. Called automatically by the default entry. |

// Register only what you need| `registerShikiLanguage({ id, loader, aliases? })` | Registers or overrides a grammar. Loader can point to local modules or remote ESM sources. |

registerShikiLanguages([| `registerShikiLanguages([...])` | Batch wrapper for additive registration. |

    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },| `unregisterShikiLanguage('id')` | Removes a single language loader (and its aliases) from the registry. |

    { id: 'python', loader: () => import('@shikijs/langs/python') },| `excludeShikiLanguages(['id'])` | Removes multiple loaders (and aliases) from the registry. Useful after defaults to drop unused grammars. |

    { id: 'json', loader: () => import('@shikijs/langs/json') },| `clearRegisteredShikiLanguages()` | Clears the registry entirely. Typically followed by your own `registerShikiLanguages([...])`. |

]);| `useShikiHighlighter()` | Creates or reuses the singleton highlighter with whatever is currently registered. Note: CDN/remote loaders are filtered out during initialization. |

```| `loadRegisteredShikiLanguage('id')` | On-demand loader for languages registered after the highlighter initialised, or for loading CDN/remote languages. |



------



## Core Entry## 4. CDN Loader Patterns



The core entry gives you **complete control** with no pre-registered languages.The default bundle includes CDN loaders for certain languages (C++, Java, C, C#, PHP, Ruby, Kotlin, Swift, SQL) to keep the published package lean. These loaders work as follows:



```ts```ts

import { export const createCdnLanguageLoader = (

    StreamMarkdown,    specifier: string

    registerShikiLanguages ): LanguageInput => {

} from 'streamdown-vue/core';    const local = () =>

        import(

// Registry is empty - register what you need            /* @vite-ignore */

registerShikiLanguages([            `@shikijs/langs/${specifier}`

    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },        );

    { id: 'markdown', loader: () => import('@shikijs/langs/markdown') },    const remote = () =>

]);        import(

```            /* @vite-ignore */

            `${SHIKI_CDN_BASE}${specifier}.mjs`

This is ideal for:        );

- Minimal bundle sizes    const loader: LanguageInput = async () => {

- Applications that only use 1-2 languages        if (typeof window === 'undefined') {

- Custom language sets            return local();

        }

---        try {

            return await remote();

## Registry API Reference        } catch {

            return local();

### Core Functions        }

    };

#### `registerShikiLanguage(config)`    return markRemoteLoader(loader);

};

Register a single language.```



```ts**Key behaviors:**

registerShikiLanguage({

    id: 'rust',- **Client-side**: Attempts to fetch from `https://esm.sh/@shikijs/langs@3.12.1/es2022/` and falls back to local `@shikijs/langs` import if the CDN fails.

    loader: () => import('@shikijs/langs/rust'),- **SSR**: Directly uses the local `@shikijs/langs` import (no CDN attempt).

    aliases: ['rs'],- **Initialization**: CDN/remote loaders are marked with a special flag and **filtered out** during initial highlighter creation by `useShikiHighlighter()`. They are only loaded on-demand when a matching code fence appears via `loadRegisteredShikiLanguage()`.

});

```This design ensures:

1. The published bundle stays minimal (no grammar files included by default for these languages)

**Parameters:**2. SSR works correctly with local fallbacks

- `id` (string) – The canonical language ID (e.g., `'typescript'`)3. Client-side users benefit from CDN caching

- `loader` (LanguageInput) – A function that imports the grammar4. The highlighter initialization is fast (doesn't load unused grammars)

- `aliases` (string[], optional) – Alternative names for the language

### TypeScript declarations for remote modules

#### `registerShikiLanguages(configs)`

When importing from a CDN you may need to declare the module pattern to silence TS errors. We ship `src/shiki/remote-modules.d.ts` with the following declaration:

Register multiple languages at once.

```ts

```tsdeclare module 'https://esm.sh/@shikijs/langs@3.12.1/es2022/*.mjs' {

registerShikiLanguages([    const mod: any;

    { id: 'rust', loader: () => import('@shikijs/langs/rust') },    export default mod;

    { id: 'go', loader: () => import('@shikijs/langs/go') },}

]);```

````

Update the pattern/version to match the URLs you use if you create custom CDN loaders.

#### `unregisterShikiLanguage(id)`

---

Remove a single language and its aliases.

## 5. Troubleshooting

````ts

unregisterShikiLanguage('rust');| Symptom | Cause | Fix |

```| --- | --- | --- |

| Language renders without syntax highlighting | Loader never registered, or it's a CDN language not yet loaded | Call `registerShikiLanguage({ id, loader })` before rendering, or ensure `loadRegisteredShikiLanguage(id)` is called for CDN languages. |

#### `excludeShikiLanguages(ids)`| Default language still bundled | You re-ran `registerDefaultShikiLanguages()` or never excluded it | Call `excludeShikiLanguages([...])` after the defaults register or start from `clearRegisteredShikiLanguages()`. |

| CDN import shows errors in TypeScript | Missing type declaration for remote modules | Add a declaration like `declare module 'https://esm.sh/@shikijs/langs@3.12.1/es2022/*.mjs'` (see section 4). |

Remove multiple languages at once.| Added loader after highlighter initialised | Highlighter already captured the registered list | Call `loadRegisteredShikiLanguage('id')` to load it dynamically. |

| CDN language works in dev but not production | Build process may not support dynamic imports of URLs | The fallback to local `@shikijs/langs` should handle this automatically. Ensure `@shikijs/langs` is in your dependencies. |

```ts

excludeShikiLanguages(['rust', 'go', 'java']);---

````

For quick examples, see `examples/basic/App.vue`, which demonstrates language registration patterns, and the [README](../README.md) for usage overview.

#### `clearRegisteredShikiLanguages()`

Clear the entire registry.

```ts
clearRegisteredShikiLanguages();
```

#### `registerDefaultShikiLanguages()`

Manually trigger default language registration. Only works once (idempotent).

```ts
import { registerDefaultShikiLanguages } from 'streamdown-vue/core';

registerDefaultShikiLanguages(); // Adds all defaults
```

> **Note:** This is automatically called when you import from `streamdown-vue`, but NOT from `streamdown-vue/core`.

### Highlighter Functions

#### `useShikiHighlighter()`

Creates or returns the singleton Shiki highlighter instance.

```ts
import { useShikiHighlighter } from 'streamdown-vue';

const highlighter = await useShikiHighlighter();
```

**Important:** Only languages registered at the time of first call are loaded into the highlighter. CDN/remote loaders are automatically excluded during initialization.

#### `loadRegisteredShikiLanguage(id)`

Dynamically load a language after the highlighter has been initialized.

```ts
import { loadRegisteredShikiLanguage } from 'streamdown-vue';

// Load a language on-demand
await loadRegisteredShikiLanguage('cpp');
```

This is used internally when CDN languages are encountered for the first time.

---

## CDN Loaders Explained

### How CDN Loaders Work

CDN loaders are a special type of loader that minimizes bundle size by loading grammars from a CDN instead of bundling them.

The implementation in `src/shiki/cdn.ts`:

```ts
export const createCdnLanguageLoader = (specifier: string): LanguageInput => {
    const local = () => import(`@shikijs/langs/${specifier}`);
    const remote = () =>
        import(`https://esm.sh/@shikijs/langs@3.12.1/es2022/${specifier}.mjs`);

    const loader: LanguageInput = async () => {
        if (typeof window === 'undefined') {
            // SSR: use local import
            return local();
        }
        try {
            // Browser: try CDN first
            return await remote();
        } catch {
            // Fallback to local
            return local();
        }
    };
    return markRemoteLoader(loader);
};
```

### Key Behaviors

1. **SSR (Server-Side Rendering):**

    - Immediately uses local import from `@shikijs/langs`
    - No network requests attempted

2. **Browser:**

    - First tries to load from `https://esm.sh/@shikijs/langs@3.12.1/es2022/`
    - Falls back to local import if CDN fails

3. **Initialization:**
    - CDN loaders are marked with a special flag
    - They're **excluded** during initial highlighter creation
    - Loaded on-demand when first encountered via `loadRegisteredShikiLanguage()`

### Creating Custom CDN Loaders

```ts
import { registerShikiLanguage } from 'streamdown-vue';
import { createCdnLanguageLoader } from 'streamdown-vue/core'; // if needed

// Using the built-in CDN loader
registerShikiLanguage({
    id: 'haskell',
    loader: createCdnLanguageLoader('haskell'),
});

// Or create your own
registerShikiLanguage({
    id: 'ocaml',
    loader: async () => {
        if (typeof window === 'undefined') {
            return import('@shikijs/langs/ocaml');
        }
        return import('https://esm.sh/@shikijs/langs@3.12.1/es2022/ocaml.mjs');
    },
});
```

### TypeScript Support for CDN URLs

To avoid TypeScript errors with CDN imports, add this declaration:

```ts
// remote-modules.d.ts
declare module 'https://esm.sh/@shikijs/langs@3.12.1/es2022/*.mjs' {
    const mod: any;
    export default mod;
}
```

This declaration is included in `streamdown-vue` at `src/shiki/remote-modules.d.ts`.

---

## Common Patterns

### Pattern 1: Minimal Bundle (Core + Few Languages)

```ts
import { StreamMarkdown, registerShikiLanguages } from 'streamdown-vue/core';

registerShikiLanguages([
    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },
    { id: 'json', loader: () => import('@shikijs/langs/json') },
]);
```

### Pattern 2: Default Set + Custom Languages

```ts
import { StreamMarkdown, registerShikiLanguage } from 'streamdown-vue';

// Defaults are already loaded
registerShikiLanguage({
    id: 'dart',
    loader: () => import('@shikijs/langs/dart'),
});
```

### Pattern 3: Default Set - Unwanted Languages

```ts
import { StreamMarkdown, excludeShikiLanguages } from 'streamdown-vue';

// Remove languages you don't use
excludeShikiLanguages(['rust', 'go', 'diff']);
```

### Pattern 4: CDN for Rare Languages

```ts
import { StreamMarkdown, registerShikiLanguage } from 'streamdown-vue';
import { createCdnLanguageLoader } from 'streamdown-vue/core';

// Add a rarely-used language via CDN
registerShikiLanguage({
    id: 'fortran',
    loader: createCdnLanguageLoader('fortran'),
});
```

### Pattern 5: Pre-load CDN Language

```ts
import {
    StreamMarkdown,
    useShikiHighlighter,
    loadRegisteredShikiLanguage,
} from 'streamdown-vue';

// In a component setup or onMounted
await useShikiHighlighter(); // Initialize first
await loadRegisteredShikiLanguage('cpp'); // Pre-load C++
```

---

## Troubleshooting

### Code Block Not Highlighted

**Symptom:** Code fence renders as plain `<pre><code>` without syntax highlighting.

**Causes:**

1. Language not registered
2. CDN language not yet loaded
3. Typo in language ID

**Solutions:**

```ts
// Check if you registered the language
import { registerShikiLanguage } from 'streamdown-vue';

registerShikiLanguage({
    id: 'elixir',
    loader: () => import('@shikijs/langs/elixir'),
});

// For CDN languages, explicitly load them
import { loadRegisteredShikiLanguage } from 'streamdown-vue';
await loadRegisteredShikiLanguage('cpp');

// Verify language ID at https://shiki.style/languages
```

### Language Still in Bundle After Excluding

**Symptom:** Bundle size didn't decrease after calling `excludeShikiLanguages()`.

**Cause:** Exclusion called after highlighter initialization, or `registerDefaultShikiLanguages()` called again.

**Solution:**

```ts
// Exclude BEFORE first useShikiHighlighter() call
import { excludeShikiLanguages } from 'streamdown-vue';

excludeShikiLanguages(['rust', 'go']);

// Then use the component...
```

### CDN Language Fails in Production

**Symptom:** CDN language works in dev but fails in production build.

**Cause:** Build tool may not support dynamic import of URLs, or `@shikijs/langs` not in dependencies.

**Solution:**

```json
// package.json - ensure @shikijs/langs is a dependency
{
    "dependencies": {
        "@shikijs/langs": "^3.12.1"
    }
}
```

The local fallback will handle it automatically.

### TypeScript Errors with CDN Imports

**Symptom:** TypeScript complains about CDN module imports.

**Cause:** No type declaration for the CDN URL pattern.

**Solution:**

```ts
// types/remote-modules.d.ts
declare module 'https://esm.sh/@shikijs/langs@3.12.1/es2022/*.mjs' {
    const mod: any;
    export default mod;
}
```

### Language Added After Highlighter Init

**Symptom:** Registered a language but it's not highlighting.

**Cause:** Highlighter was already initialized before registration.

**Solution:**

```ts
import { loadRegisteredShikiLanguage } from 'streamdown-vue';

// Dynamically load the new language
await loadRegisteredShikiLanguage('newlang');

// Or reload the page
```

### Unregistered Language Warning in Console

**Symptom:** `[streamdown-vue] Some requested Shiki languages are not registered: ...`

**Cause:** Code fence references a language that isn't registered.

**Solution:**

```ts
// Register the missing language
registerShikiLanguage({
    id: 'missing-lang',
    loader: () => import('@shikijs/langs/missing-lang'),
});
```

### No Languages Registered Warning

**Symptom:** `[streamdown-vue] No Shiki languages are registered. Code blocks will render without syntax highlighting.`

**Cause:** Using `streamdown-vue/core` without registering any languages, or cleared the registry without re-populating.

**Solution:**

```ts
import { registerShikiLanguages } from 'streamdown-vue/core';

registerShikiLanguages([
    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },
    // ... add more
]);
```

---

## Additional Resources

-   [Shiki Languages List](https://shiki.style/languages) – Complete list of available languages
-   [Shiki Documentation](https://shiki.style) – Official Shiki docs
-   [Examples](../examples/basic/App.vue) – See working examples in the repo
-   [README](../README.md) – Main library documentation
