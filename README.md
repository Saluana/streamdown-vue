# vuedown

Vuedown provides a `<StreamMarkdown>` component that mirrors the feature set of
[Streamdown](https://github.com/vercel/streamdown) for Vue/Nuxt apps. It splits
incoming Markdown into blocks, repairs incomplete syntax during streaming, and
renders each block incrementally.

### Features

- GitHub‑flavored Markdown (tables, task lists, strikethrough)
- KaTeX math rendering
- Syntax‑highlighted code blocks with copy button and light/dark themes (Shiki)
- Mermaid diagrams with loading spinner, error recovery and copy button
- Auto‑fixes incomplete Markdown tokens while streaming
- Link and image prefix allow‑list for security
- Tailwind‑friendly styling (`space-y-4`, responsive tables, inline code styling, etc.)

## Usage

```ts
import { StreamMarkdown } from 'vuedown'
```

```vue
<template>
  <StreamMarkdown :content="markdown" />
</template>
```

## Development

- `bun build` – build the package into `dist`
- `bun test` – run unit tests
