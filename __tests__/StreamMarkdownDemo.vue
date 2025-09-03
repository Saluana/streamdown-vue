<template>
    <div class="p-4 space-y-4 border rounded-md">
        <h2 class="text-lg font-semibold">StreamMarkdown Demo</h2>
        <p class="text-sm opacity-70">
            Click "Start" to simulate streaming markdown chunks. Open devtools
            console to see detailed logs.
        </p>
        <div class="flex gap-2">
            <button
                class="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40"
                :disabled="running"
                @click="start"
            >
                Start
            </button>
            <button
                class="px-3 py-1 rounded bg-gray-600 text-white disabled:opacity-40"
                :disabled="!running && !buffer.length"
                @click="() => reset()"
            >
                Reset
            </button>
            <button
                class="px-3 py-1 rounded bg-amber-600 text-white disabled:opacity-40"
                :disabled="!running"
                @click="cancel"
            >
                Cancel
            </button>
        </div>
        <div
            class="text-xs font-mono whitespace-pre-wrap bg-black/5 dark:bg-white/10 p-2 rounded max-h-40 overflow-auto"
            v-if="debug"
        >
            <strong>Last Event:</strong> {{ lastEvent }}\n
            <strong>Chunks Sent:</strong> {{ sent }}/{{ chunks.length }}\n
            <strong>Buffer Length:</strong> {{ buffer.length }} chars\n
            <strong>Blocks:</strong> {{ blocks.length }}
        </div>
        <StreamMarkdown :content="rendered" class="prose max-w-none" />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
    StreamMarkdown,
    parseBlocks,
    parseIncompleteMarkdown,
} from 'streamdown-vue';

interface DemoChunk {
    delay: number;
    text: string;
}

// A mix of headings, lists, code, math, mermaid & an intentionally split bold token
const chunks = ref<DemoChunk[]>([
    { delay: 300, text: '# Streaming Demo\n\nThis demo shows **incremental' },
    { delay: 280, text: ' markdown** rendering with:' },
    { delay: 240, text: '\n\n- Lists' },
    { delay: 240, text: '\n- `inline code` & code blocks' },
    { delay: 260, text: '\n- Math like $e^{i\\pi}+1=0$ and a block:' },
    { delay: 480, text: '\n\n$$\\begin{matrix}1 & 2\\\\3 & 4\\end{matrix}$$' },
    {
        delay: 320,
        text: '\n\n```ts\nconst greet = (name: string) => `hi ${name}`;\n```',
    },
    { delay: 400, text: '\n\n```mermaid\ngraph TD;A-->B;B-->C;\n```' },
    { delay: 500, text: '\n\nEnd of stream.' },
]);

const running = ref(false);
const cancelled = ref(false);
const buffer = ref('');
const rendered = ref('');
const blocks = ref<string[]>([]);
const sent = ref(0);
const lastEvent = ref('idle');
const debug = ref(true);
let timer: any = null;

function log(step: string, added: string) {
    console.groupCollapsed(`StreamMarkdownDemo: ${step}`);
    console.log('Added Chunk:', JSON.stringify(added));
    console.log('Raw Buffer Len:', buffer.value.length);
    console.log('Repaired Buffer:', buffer.value);
    console.log('Blocks:', blocks.value);
    console.groupEnd();
    lastEvent.value = step;
}

function tick(): void {
    if (cancelled.value) {
        running.value = false;
        return;
    }
    if (sent.value >= chunks.value.length) {
        running.value = false;
        log('complete', '');
        return;
    }
    const idx = sent.value;
    const chunk = chunks.value[idx];
    if (!chunk) {
        running.value = false;
        log('missing-chunk', String(idx));
        return;
    }
    sent.value = idx + 1;
    buffer.value += chunk.text;
    const repaired = parseIncompleteMarkdown(buffer.value);
    // For display we keep the repaired version (so user sees stable formatting)
    const blk = parseBlocks(repaired);
    blocks.value = blk;
    rendered.value = blk.join('');
    log('chunk', chunk.text);
    timer = setTimeout(tick, chunk.delay);
}

function start() {
    if (running.value) return;
    reset(false);
    running.value = true;
    cancelled.value = false;
    log('start', '');
    tick();
}

function cancel() {
    cancelled.value = true;
    if (timer) clearTimeout(timer);
    log('cancelled', '');
}

function reset(clearRendered = true): void {
    if (timer) clearTimeout(timer);
    running.value = false;
    cancelled.value = false;
    buffer.value = '';
    blocks.value = [];
    sent.value = 0;
    lastEvent.value = 'reset';
    if (clearRendered) rendered.value = '';
    log('reset', '');
}
</script>

<style scoped>
button {
    font-weight: 600;
}
</style>
