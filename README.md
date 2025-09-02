# vuedown

Vuedown provides a `<StreamMarkdown>` component that mirrors the feature set of
[Streamdown](https://github.com/vercel/streamdown) for Vue/Nuxt apps. It splits
incoming Markdown into blocks, repairs incomplete syntax during streaming, and
renders each block incrementally.

### Features

- GitHub‑flavored Markdown (tables, task lists, strikethrough)
- KaTeX math rendering
- Advanced LaTeX fixes for matrices and dollar-sign math
- Syntax‑highlighted code blocks with copy button and light/dark themes (Shiki)
- Mermaid diagrams with loading spinner, error recovery and copy button
- Auto‑fixes incomplete Markdown tokens while streaming
- Link and image prefix allow‑list for security
- Tailwind‑friendly styling (`space-y-4`, responsive tables, inline code styling, etc.)

## Usage

```ts
import { StreamMarkdown, parseBlocks, parseIncompleteMarkdown } from 'vuedown'
```

```vue
<template>
  <StreamMarkdown :content="markdown" />
</template>
```

### Styling

Vuedown uses Tailwind utility classes. If your project already has Tailwind
configured (Nuxt or Vite), no additional configuration is required. Make sure to
import the KaTeX CSS once:

```ts
import 'katex/dist/katex.min.css';
```

Example Nuxt/Vite component:

```vue
<template>
  <StreamMarkdown class="prose" :content="markdown" />
</template>

<script setup lang="ts">
import { StreamMarkdown } from 'vuedown'
import 'katex/dist/katex.min.css'
const markdown = '# Hello\n\nSome *MD*';
</script>
```

## Development

- `bun build` – build the package into `dist`
- `bun test` – run unit tests
