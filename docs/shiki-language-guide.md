# Shiki Language Configuration Guide

Streamdown Vue uses [Shiki](https://shiki.style) for syntax highlighting. This guide explains how the language registry works, what the default bundle includes, and how to customize it. For the authoritative list of Shiki grammars and aliases, see the official [Shiki Languages Reference](https://shiki.style/languages).

---

## 1. Entries at a Glance

| Entry                 | What it does                                                                     | When to use                                       |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `streamdown-vue`      | Calls `registerDefaultShikiLanguages()` once to register a curated language set. | You want defaults with minimal setup.             |
| `streamdown-vue/core` | Exposes the public API without registering any languages.                        | You need a minimal bundle or full manual control. |

Both entry points re-export the registry helpers in `src/shiki/registry.ts` (see §4).

---

## 2. Default Entry (`streamdown-vue`)

### 2.1 Languages Registered Automatically

Importing the default entry invokes `registerDefaultShikiLanguages()` (see `src/shiki/register-default-languages.ts`). It registers the following lists:

**Bundled locally (eagerly loaded):**

```
bash, css, diff, go, html, javascript, jsx, json,
markdown, python, rust, shell, tsx, typescript, vue, yaml
```

**CDN-backed (lazy loaded with local fallback):**

```
c, cpp, csharp, java, kotlin, php, ruby, sql, swift
```

CDN grammars stay out of the published bundle to keep it lean.

#### 2.1.1 Full default list (IDs, aliases, source)

| ID           | Aliases                                    | Source |
| ------------ | ------------------------------------------ | ------ |
| `cpp`        | `c++`                                      | CDN    |
| `java`       | `java`                                     | CDN    |
| `c`          | —                                          | CDN    |
| `csharp`     | `cs`, `c#`                                 | CDN    |
| `php`        | —                                          | CDN    |
| `ruby`       | —                                          | CDN    |
| `kotlin`     | —                                          | CDN    |
| `swift`      | —                                          | CDN    |
| `sql`        | —                                          | CDN    |
| `typescript` | `ts`                                       | local  |
| `tsx`        | —                                          | local  |
| `javascript` | `js`                                       | local  |
| `jsx`        | —                                          | local  |
| `json`       | —                                          | local  |
| `bash`       | —                                          | local  |
| `shell`      | `shellscript`, `shellsession`, `sh`, `zsh` | local  |
| `python`     | `py`                                       | local  |
| `diff`       | —                                          | local  |
| `markdown`   | `md`                                       | local  |
| `vue`        | —                                          | local  |
| `html`       | —                                          | local  |
| `css`        | —                                          | local  |
| `go`         | —                                          | local  |
| `rust`       | —                                          | local  |
| `yaml`       | `yml`                                      | local  |

### 2.2 Default Aliases

```
'c++' → 'cpp'
'cs', 'c#' → 'csharp'
'sh', 'zsh', 'shellscript', 'shellsession' → 'shell'
'js' → 'javascript'
'ts' → 'typescript'
'py' → 'python'
'md' → 'markdown'
'yml' → 'yaml'
```

### 2.3 Customizing the Defaults

Add an extra grammar:

```ts
import { registerShikiLanguage } from 'streamdown-vue';

registerShikiLanguage({
    id: 'elixir',
    loader: () => import('@shikijs/langs/elixir'),
});
```

Remove unused defaults (do this before the first `useShikiHighlighter()` call):

```ts
import { excludeShikiLanguages } from 'streamdown-vue';

excludeShikiLanguages(['rust', 'go']);
```

Start from scratch without switching entry points:

```ts
import {
    clearRegisteredShikiLanguages,
    registerShikiLanguages,
} from 'streamdown-vue';

clearRegisteredShikiLanguages();
registerShikiLanguages([
    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },
    { id: 'json', loader: () => import('@shikijs/langs/json') },
]);
```

---

## 3. Core Entry (`streamdown-vue/core`)

The core entry keeps the registry empty so you can supply only what you need:

```ts
import { StreamMarkdown, registerShikiLanguages } from 'streamdown-vue/core';

registerShikiLanguages([
    { id: 'markdown', loader: () => import('@shikijs/langs/markdown') },
    { id: 'typescript', loader: () => import('@shikijs/langs/typescript') },
]);
```

Rendering without any registered languages triggers:

```
[streamdown-vue] No Shiki languages are registered. Code blocks will render without syntax highlighting.
```

---

## 4. Registry Helper Reference

| Helper                                            | Description                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerDefaultShikiLanguages()`                 | Idempotently registers the default set. Auto-called by the default entry.                                                                         |
| `registerShikiLanguage({ id, loader, aliases? })` | Adds or overrides a single grammar. Optional aliases are normalized in `src/shiki/registry.ts`.                                                   |
| `registerShikiLanguages(configs)`                 | Batch wrapper around `registerShikiLanguage`.                                                                                                     |
| `unregisterShikiLanguage(id)`                     | Removes one grammar and its aliases.                                                                                                              |
| `excludeShikiLanguages(ids)`                      | Removes multiple grammars.                                                                                                                        |
| `clearRegisteredShikiLanguages()`                 | Clears both the loader map and the alias map.                                                                                                     |
| `useShikiHighlighter()`                           | Returns the singleton highlighter. Only non-remote loaders registered prior to the first call are eagerly loaded; warns if nothing is registered. |
| `loadRegisteredShikiLanguage(id)`                 | Loads a registered grammar on demand. Required for CDN loaders.                                                                                   |

---

## 5. CDN Loaders

`src/shiki/cdn.ts` exports `createCdnLanguageLoader(specifier)`. Each loader:

1. Uses `import('@shikijs/langs/<specifier>')` when `typeof window === 'undefined'` (SSR/local fallback).
2. In the browser, tries `https://esm.sh/@shikijs/langs@3.12.1/es2022/<specifier>.mjs` first, falling back to the local import on failure.
3. Marks the loader with an internal symbol so `useShikiHighlighter()` skips it during initial creation.

Because CDN loaders are filtered out initially, Streamdown Vue calls `loadRegisteredShikiLanguage(id)` the first time a matching fence is encountered.

### 5.1 Custom Remote Loader Example

```ts
import { registerShikiLanguage } from 'streamdown-vue';
import { createCdnLanguageLoader } from 'streamdown-vue/core';

registerShikiLanguage({
    id: 'haskell',
    loader: createCdnLanguageLoader('haskell'),
});
```

If you point to a custom CDN, add a declaration for TypeScript:

```ts
// remote-modules.d.ts
declare module 'https://my.cdn.example/shiki/*.mjs' {
    const mod: any;
    export default mod;
}
```

The package already ships `src/shiki/remote-modules.d.ts` covering the esm.sh URLs used in the defaults.

---

## 6. Common Patterns

Minimal bundle:

```ts
import { registerShikiLanguages } from 'streamdown-vue/core';

registerShikiLanguages([
    { id: 'markdown', loader: () => import('@shikijs/langs/markdown') },
    { id: 'javascript', loader: () => import('@shikijs/langs/javascript') },
]);
```

Defaults plus an add-on:

```ts
import { registerShikiLanguage } from 'streamdown-vue';

registerShikiLanguage({
    id: 'dart',
    loader: () => import('@shikijs/langs/dart'),
});
```

Trim defaults:

```ts
import { excludeShikiLanguages } from 'streamdown-vue';

excludeShikiLanguages(['rust', 'go']);
```

CDN-only language:

```ts
import { registerShikiLanguage } from 'streamdown-vue';
import { createCdnLanguageLoader } from 'streamdown-vue/core';

registerShikiLanguage({
    id: 'fortran',
    loader: createCdnLanguageLoader('fortran'),
});
```

Preload a CDN grammar after initialization:

```ts
import {
    useShikiHighlighter,
    loadRegisteredShikiLanguage,
} from 'streamdown-vue';

await useShikiHighlighter();
await loadRegisteredShikiLanguage('cpp');
```

---

## 7. Troubleshooting

| Symptom                                     | Likely cause                                                                     | Recommended fix                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Code fence renders without highlighting     | Grammar missing from the registry or CDN grammar not yet loaded.                 | Register the grammar and, for CDN entries, call `loadRegisteredShikiLanguage(id)` before rendering. |
| Console warns about missing languages       | Markdown references an ID without a loader.                                      | Register that ID or add an alias pointing to an existing grammar.                                   |
| Bundle still contains an excluded grammar   | `useShikiHighlighter()` ran before `excludeShikiLanguages()`.                    | Exclude languages before the first highlighter initialization.                                      |
| CDN grammar fails in production             | Remote dynamic imports blocked or local fallback missing.                        | Keep `@shikijs/langs` in dependencies so the fallback import succeeds.                              |
| TypeScript error for CDN import             | Missing module declaration for the CDN URL glob.                                 | Add a declaration like the snippet in §5.                                                           |
| "No Shiki languages are registered" warning | Using the core entry without registering languages, or you cleared the registry. | Call `registerShikiLanguages([...])` before rendering.                                              |

---

## 8. Additional Resources

-   [Shiki Languages Reference](https://shiki.style/languages)
-   [Shiki Documentation](https://shiki.style)
-   `examples/basic/App.vue`
-   [Project README](../README.md)
