import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import { StreamMarkdown } from '../../index';

type FixtureName = 'prose' | 'math' | 'mixed' | 'references';
type ProfileMode = 'cache' | 'bypass';

type ProfileResult = {
    fixture: FixtureName;
    mode: ProfileMode;
    instances: number;
    characters: number;
    chunks: number;
    cadenceMs: number;
    updateWorkMs: number;
    medianUpdateMs: number;
    p95UpdateMs: number;
    maxUpdateMs: number;
    slowUpdates: number;
    p95FrameMs: number;
    maxFrameMs: number;
    slowFrames: number;
    longTasks: number;
    longTaskMs: number;
    wallMs: number;
};

const prose = Array.from(
    { length: 30 },
    (_, index) => `## Prose section ${index + 1}\n\n${`Paragraph ${index + 1} contains deterministic **bold**, *italic*, and inline \`code\` for repeatable streaming measurement. `.repeat(2)}`
).join('\n\n');

const math = Array.from(
    { length: 40 },
    (_, index) => `## Equation ${index + 1}\n\n$$\n\\sum_{i=1}^{${index + 2}} i^2 = \\frac{n(n+1)(2n+1)}{6}\n$$\n\nEquation commentary ${index + 1}.`
).join('\n\n');

const mixed = Array.from({ length: 25 }, (_, index) => {
    const number = index + 1;
    return `## Mixed section ${number}\n\nParagraph ${number} with **formatting** and a [safe link](https://example.com/${number}).\n\n- item ${number}.1\n- item ${number}.2\n\n$$\nx_${number}^2 + y_${number}^2 = z_${number}^2\n$$\n\n\`\`\`\nconst value${number} = ${number};\nconsole.log(value${number});\n\`\`\``;
}).join('\n\n');

const references = Array.from(
    { length: 30 },
    (_, index) => `## Reference section ${index + 1}\n\nRead [document ${index + 1}][doc-${index + 1}] for deterministic fallback content. ${'Additional prose keeps this fixture comparable. '.repeat(2)}\n\n[doc-${index + 1}]: https://example.com/docs/${index + 1}`
).join('\n\n');

const fixtures: Record<FixtureName, string> = {
    prose,
    math,
    mixed,
    references,
};

const bypassPlugin = () => {};
const resultElement = document.querySelector<HTMLElement>('#result')!;
const rootElement = document.querySelector<HTMLElement>('#profile-root')!;
let mountedApp: App | null = null;

const percentile = (values: number[], fraction: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(sorted.length * fraction) - 1)
    );
    return sorted[index] ?? 0;
};

const delay = (milliseconds: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const dispose = async () => {
    mountedApp?.unmount();
    mountedApp = null;
    rootElement.replaceChildren();
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const run = async (
    fixture: FixtureName,
    mode: ProfileMode,
    instances = 1,
    cadenceMs = 16,
    chunkSize = 64
): Promise<ProfileResult> => {
    await dispose();
    const source = fixtures[fixture];
    const chunks = Array.from(
        { length: Math.ceil(source.length / chunkSize) },
        (_, index) => source.slice(index * chunkSize, (index + 1) * chunkSize)
    );
    const contents = Array.from({ length: instances }, () => ref(''));
    const Root = defineComponent({
        setup: () => () =>
            h(
                'div',
                contents.map((content, index) =>
                    h(
                        'section',
                        { class: 'profile-instance', 'data-instance': index },
                        [
                            h(StreamMarkdown, {
                                content: content.value,
                                remarkPlugins:
                                    mode === 'bypass' ? [bypassPlugin] : [],
                            }),
                        ]
                    )
                )
            ),
    });
    mountedApp = createApp(Root);
    mountedApp.mount(rootElement);
    await nextTick();

    const updateDurations: number[] = [];
    const frameDurations: number[] = [];
    const longTasks: number[] = [];
    const observer =
        typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes.includes('longtask')
            ? new PerformanceObserver((list) => {
                  longTasks.push(
                      ...list.getEntries().map((entry) => entry.duration)
                  );
              })
            : null;
    observer?.observe({ entryTypes: ['longtask'] });

    const wallStart = performance.now();
    for (const chunk of chunks) {
        const updateStart = performance.now();
        for (const content of contents) content.value += chunk;
        await nextTick();
        const updateDuration = performance.now() - updateStart;
        updateDurations.push(updateDuration);
        const frameDuration = await new Promise<number>((resolve) =>
            requestAnimationFrame(() => resolve(performance.now() - updateStart))
        );
        frameDurations.push(frameDuration);
        if (cadenceMs > 0) {
            await delay(Math.max(0, cadenceMs - frameDuration));
        }
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    observer?.disconnect();

    const profile: ProfileResult = {
        fixture,
        mode,
        instances,
        characters: source.length,
        chunks: chunks.length,
        cadenceMs,
        updateWorkMs: updateDurations.reduce((sum, value) => sum + value, 0),
        medianUpdateMs: percentile(updateDurations, 0.5),
        p95UpdateMs: percentile(updateDurations, 0.95),
        maxUpdateMs: Math.max(...updateDurations),
        slowUpdates: updateDurations.filter((value) => value > 16.67).length,
        p95FrameMs: percentile(frameDurations, 0.95),
        maxFrameMs: Math.max(...frameDurations),
        slowFrames: frameDurations.filter((value) => value > 16.67).length,
        longTasks: longTasks.length,
        longTaskMs: longTasks.reduce((sum, value) => sum + value, 0),
        wallMs: performance.now() - wallStart,
    };
    resultElement.textContent = JSON.stringify(profile, null, 2);
    return profile;
};

const api = {
    fixtures: Object.fromEntries(
        Object.entries(fixtures).map(([name, value]) => [name, value.length])
    ),
    run,
    dispose,
};

declare global {
    interface Window {
        __streamdownProfile: typeof api;
    }
}

window.__streamdownProfile = api;
document.querySelector('#smoke')?.addEventListener('click', () => {
    void run('mixed', 'cache', 1, 0);
});
