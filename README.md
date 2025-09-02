# streamdown-vue

streamdown-vue brings [Streamdown](https://github.com/vercel/streamdown)-style streaming Markdown to Vue 3 and Nuxt 3. It ships a `<StreamMarkdown>` component that incrementally renders Markdown as it arrives, keeping UIs snappy even when content is streamed token by token.

## Features

-   GitHub‑flavored Markdown support (tables, task lists, strikethrough)
-   KaTeX math with extra LaTeX fixes for matrices and dollar-sign math
-   Shiki‑powered syntax highlighting with copy button and light/dark themes
-   Mermaid diagrams with loading spinner, copy button and error recovery
-   Automatically repairs incomplete Markdown tokens while streaming
-   Configurable security allow‑lists for links and images
-   Tailwind‑friendly styling (`space-y-4`, responsive tables, inline code styling)

## Installation

### Bun

```bash
bun add streamdown-vue
```

### npm / pnpm / yarn

```bash
npm install streamdown-vue
```

## Quick start

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import 'katex/dist/katex.min.css';
createApp(App).mount('#app');
```

```vue
<!-- App.vue -->
<template>
    <StreamMarkdown class="prose" :content="markdown" />
</template>

<script setup lang="ts">
import { StreamMarkdown } from 'streamdown-vue';
const markdown = '# Hello\n\nSome *MD*';
</script>
```

## Streaming example

The utilities `parseBlocks` and `parseIncompleteMarkdown` help you render while content is still arriving from a `ReadableStream` (e.g. an AI or SSE endpoint).

```ts
import {
    StreamMarkdown,
    parseBlocks,
    parseIncompleteMarkdown,
} from 'streamdown-vue';

const res = await fetch('/api/stream');
const reader = res.body!.getReader();
let buffer = '';
let blocks: string[] = [];

while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += new TextDecoder().decode(value);
    buffer = parseIncompleteMarkdown(buffer);
    blocks = parseBlocks(buffer);
    // use blocks.join('') as the content for <StreamMarkdown>
}
```

## Customisation

### Override built‑in components

```vue
<StreamMarkdown :components="{ code: MyCodeBlock }" />
```

### Add remark/rehype plugins

```vue
<StreamMarkdown :remark-plugins="[myRemark]" :rehype-plugins="[myRehype]" />
```

### Security options

```vue
<StreamMarkdown
    :allowed-link-prefixes="['https://']"
    :allowed-image-prefixes="['https://cdn.example.com']"
    default-origin="https://example.com"
/>
```

## Styling

streamdown-vue ships with minimal Tailwind classes. Add your own classes (e.g. `prose`) and include the KaTeX stylesheet once if you use math:

```ts
import 'katex/dist/katex.min.css';
```

## Utilities

-   `parseBlocks(text)` – split Markdown into renderable chunks for streaming.
-   `parseIncompleteMarkdown(text)` – close open Markdown tokens so partial text still renders.

Both utilities are exported from the package and can be used outside the component.

## Development

```bash
bun build   # build the package into dist/
bun test    # run unit tests
```
