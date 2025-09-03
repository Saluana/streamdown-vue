<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { StreamMarkdown } from '../../src/StreamMarkdown';

// Live markdown input (also target of streaming)
const input = ref('');
const markdown = computed(() => input.value);

// Streaming state
const streaming = ref(false);
let timer: number | null = null;

// Base demo chunk sequence (could come from a real server stream).
// We'll clone / extend this for stress testing.
const baseChunks: string[] = [
    '# Hello Vuedown Streaming Demo\n\n',
    'This content arrives in small chunks to simulate a live AI / notes feed.\n\n',
    '## 1. Quick Bullets\n- One\n',
    '- Two (with **bold** text)\n',
    '- Three with `inline code` and $E=mc^2$\n\n',
    '## 2. Table Snapshot\n',
    '| Framework | Stars | Trend |\n',
    '| --------- | -----:| :---- |\n',
    '| Vue       | 200k  | ++    |\n',
    '| Bun       |  70k  | ++    |\n',
    '| Vite      |  65k  | +     |\n\n',
    'Small paragraph after table explaining metrics. Numbers are illustrative only.\n\n',
    '### 3. Code (TypeScript)\n',
    '```ts\nexport function fib(n: number): number {\n  return n < 2 ? n : fib(n-1) + fib(n-2);\n}\n```\n\n',
    '### 4. Math Block\n',
    '$$\\int_0^1 x^2 \\, dx = 1/3$$\n',
    'And inline fraction $\\frac{a+b}{c+d}$.\n\n',
    '### 5. Mermaid Flow\n',
    '```mermaid\nflowchart LR\n  User[User] --> API((API)) --> Worker{{Worker}} --> DB[(Database)]\n  API --> Cache[(Cache)]\n```\n\n',
    '### 6. Mermaid Sequence\n',
    '```mermaid\nsequenceDiagram\n  participant A as Client\n  participant B as Server\n  A->>B: Request data\n  B-->>A: Stream chunk 1\n  B-->>A: Stream chunk 2\n  B-->>A: Stream chunk 3\n```\n\n',
    '### 7. Blockquote & Horizontal Rule\n',
    '> "Streaming markdown lets users see progress early."\n\n',
    '---\n',
    '### 8. Nested List\n',
    '- Parent A\n  - Child A1\n  - Child A2\n- Parent B\n\n',
    '### 9. Finishing Up\n',
    'Final paragraph with another inline math $a^2 + b^2 = c^2$ and some *italic* text.\n',
    '---\n',
    '### 10. Additional Table\n',
    '| Metric | Value | Notes |\n',
    '| ------ | ----: | ----- |\n',
    '| Speed  |  1.2x | vs baseline |\n',
    '| Memory |  80MB | approximate |\n\n',
    '### 11. More Code (JSON)\n',
    '```json\n{"name":"demo","items":[1,2,3]}\n```\n\n',
    '### 12. Another Mermaid Graph\n',
    '```mermaid\ngantt\n  dateFormat  YYYY-MM-DD\n  title Adding More Content\n  section Phase 1\n  Task A :a1, 2025-09-01, 1d\n  Task B :after a1 , 1d\n```\n\n',
    '### 13. Heavy Paragraph\n',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(
        4
    ) + '\n',
    '### 14. Final Note\n',
    'End of extended stream example.\n',
    '### 15. Tasks & Strike\n',
    '- [x] Write docs\n- [ ] Add tests\n- [x] Ship ~~deprecated~~ feature\n\n',
    '### 16. Security Examples\n',
    '[Safe Link](https://example.com) [Bad Link](javascript:alert(1))\n\n',
    'Allowed image: ![ok](https://cdn.example.com/img.png) Disallowed image: ![bad](http://bad.local/x.png)\n\n',
    '### 17. Matrix Math\n',
    '$$\\begin{matrix}1 & 2\\\\ 3 & 4\\end{matrix}$$\n',
];

// Working chunks (mutable) so stress mode can expand.
let chunks: string[] = [...baseChunks];

// Logging & metrics
const log = (..._a: any[]) => {};
const startTime = ref<number | null>(null);
const lastChunkAt = ref<number | null>(null);
const totalBytes = ref(0);
const chunkCount = ref(0);
const stress = ref(false);
const avgBps = computed(() => {
    if (!startTime.value || !lastChunkAt.value) return 0;
    const secs = (lastChunkAt.value - startTime.value) / 1000;
    return secs > 0 ? totalBytes.value / secs : 0;
});

// Simple client-side test harness
interface TestResult {
    name: string;
    pass: boolean;
    details?: string;
}
const testResults = ref<TestResult[]>([]);
const runningTests = ref(false);
const renderContainer = ref<HTMLElement | null>(null);

async function runClientTests() {
    if (!renderContainer.value) return;
    runningTests.value = true;
    await nextTick();
    const root = renderContainer.value;
    const results: TestResult[] = [];
    const push = (name: string, pass: boolean, details?: string) =>
        results.push({ name, pass, details });
    push(
        'mermaid present',
        !!root.querySelector('[data-streamdown="mermaid"]')
    );
    push('math present', !!root.querySelector('.katex'));
    push(
        'code block present',
        !!root.querySelector('[data-streamdown="code-block"]')
    );
    push('table present', !!root.querySelector('table'));
    push('task list checkbox', !!root.querySelector('input[type=checkbox]'));
    const badLink = Array.from(root.querySelectorAll('a')).some((a) =>
        (a as HTMLAnchorElement).href.startsWith('javascript:')
    );
    push(
        'no javascript: links',
        !badLink,
        badLink ? 'found bad link' : undefined
    );
    const badImg = !!root.querySelector('img[src*="bad.local"]');
    push('disallowed image removed', !badImg);
    const matrix = Array.from(root.querySelectorAll('.katex')).some(
        (k) => /1\/3/.test(k.textContent || '') && /1/.test(k.textContent || '')
    );
    push('matrix rendered', matrix);
    testResults.value = results;
    runningTests.value = false;
}

function pushNext(i: number) {
    if (i === 0) {
        startTime.value = performance.now();
        log('stream started. chunks=', chunks.length);
    }
    if (i >= chunks.length) {
        streaming.value = false;
        timer = null;
        const dur = startTime.value ? performance.now() - startTime.value : 0;
        log('stream finished.', {
            durationMs: dur.toFixed(1),
            bytes: totalBytes.value,
            chunks: chunkCount.value,
            avgBps: avgBps.value.toFixed(1),
        });
        // (debug output removed)
        // run client tests after final render
        runClientTests();
        return;
    }
    const piece = chunks[i];
    if (piece == null) {
        log('missing piece index', i);
        streaming.value = false;
        return;
    }
    // (debug per-chunk logging removed)
    input.value += piece;
    totalBytes.value += piece.length;
    chunkCount.value++;
    lastChunkAt.value = performance.now();
    log('chunk', i, { len: piece.length, cumulative: totalBytes.value });
    timer = window.setTimeout(() => pushNext(i + 1), 160); // quicker cadence
}

function startStream() {
    if (streaming.value) return;
    // If stress mode: replicate base chunks several times for volume.
    chunks = stress.value
        ? Array.from({ length: 4 }, () => baseChunks).flat()
        : [...baseChunks];
    input.value = '';
    totalBytes.value = 0;
    chunkCount.value = 0;
    streaming.value = true;
    pushNext(0);
}

function stopStream() {
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }
    streaming.value = false;
}

function clearAll() {
    if (streaming.value) stopStream();
    input.value = '';
}
</script>

<template>
    <div style="display: flex; gap: 1.5rem; flex-wrap: wrap">
        <div style="flex: 1 1 340px; min-width: 320px">
            <h1 style="margin-top: 0">Basic Example</h1>
            <p style="margin-top: -0.75rem; opacity: 0.8">
                Edit manually or stream generated chunks.
            </p>
            <div
                class="toolbar"
                style="
                    display: flex;
                    gap: 0.5rem;
                    margin: 0.5rem 0 1rem;
                    flex-wrap: wrap;
                "
            >
                <button @click="startStream" :disabled="streaming">
                    {{ streaming ? 'Streaming…' : 'Start Stream' }}
                </button>
                <button v-if="streaming" class="secondary" @click="stopStream">
                    Stop
                </button>
                <button
                    class="secondary"
                    @click="clearAll"
                    :disabled="streaming"
                >
                    Clear
                </button>
                <label
                    style="
                        display: flex;
                        align-items: center;
                        gap: 0.25rem;
                        font-size: 0.8rem;
                        opacity: 0.8;
                    "
                >
                    <input
                        type="checkbox"
                        v-model="stress"
                        :disabled="streaming"
                    />
                    stress
                </label>
            </div>
            <textarea
                v-model="input"
                aria-label="Markdown input"
                placeholder="Type markdown or press Start Stream"
            />
            <div
                style="
                    font-size: 0.75rem;
                    opacity: 0.7;
                    line-height: 1.3;
                    margin-top: 0.35rem;
                "
            >
                <div>chunks: {{ chunkCount }} bytes: {{ totalBytes }}</div>
                <div v-if="avgBps">avg B/s: {{ avgBps.toFixed(1) }}</div>
            </div>
        </div>
        <div style="flex: 1 1 420px; min-width: 360px; max-width: 640px">
            <div ref="renderContainer">
                <StreamMarkdown
                    :content="markdown"
                    class="prose"
                    :allowed-image-prefixes="['https://cdn.example.com/']"
                    :allowed-link-prefixes="['https://', 'http://']"
                    default-origin="https://example.com"
                />
            </div>
            <div style="margin-top: 1rem">
                <h3
                    style="margin: 0 0 0.5rem; font-size: 0.9rem; opacity: 0.75"
                >
                    Client Tests
                </h3>
                <button
                    class="secondary"
                    @click="runClientTests"
                    :disabled="streaming || runningTests"
                    style="margin-bottom: 0.5rem"
                >
                    {{ runningTests ? 'Running…' : 'Run Tests' }}
                </button>
                <ul
                    style="
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        display: grid;
                        gap: 0.25rem;
                    "
                >
                    <li
                        v-for="t in testResults"
                        :key="t.name"
                        :style="{
                            fontSize: '.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '.4rem',
                            color: t.pass ? '#10b981' : '#ef4444',
                        }"
                    >
                        <span>{{ t.pass ? '✔' : '✖' }}</span>
                        <span>{{ t.name }}</span>
                        <span v-if="t.details" style="opacity: 0.6"
                            >({{ t.details }})</span
                        >
                    </li>
                    <li
                        v-if="!testResults.length"
                        style="font-size: 0.7rem; opacity: 0.6"
                    >
                        No results yet.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<style scoped>
.prose :deep(h2) {
    margin-top: 1.75em;
    border-bottom: 1px solid #2a3344;
    padding-bottom: 0.3em;
}
.prose :deep(table) {
    border-collapse: collapse;
}
.prose :deep(td),
.prose :deep(th) {
    border: 1px solid #2a3344;
    padding: 4px 8px;
}
.prose :deep(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
