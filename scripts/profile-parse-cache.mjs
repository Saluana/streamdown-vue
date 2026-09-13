import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.STREAMDOWN_PROFILE_PORT || 4175);
const profileUrl =
    process.env.STREAMDOWN_PROFILE_URL || `http://127.0.0.1:${port}`;
const repetitions = Number(process.env.STREAMDOWN_PROFILE_RUNS || 3);
let server = null;

const waitForServer = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            const response = await fetch(profileUrl);
            if (response.ok) return;
        } catch {
            // The local Vite server is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Profile server did not start at ${profileUrl}`);
};

const startServer = async () => {
    if (process.env.STREAMDOWN_PROFILE_URL) return;
    server = spawn(
        process.execPath,
        [
            'node_modules/vite/bin/vite.js',
            'examples/performance',
            '--config',
            'vite.config.ts',
            '--host',
            '127.0.0.1',
            '--port',
            String(port),
        ],
        { stdio: ['ignore', 'pipe', 'inherit'] }
    );
    server.stdout.on('data', () => {});
    await waitForServer();
};

const mean = (values) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

const round = (value) => Math.round(value * 100) / 100;

await startServer();

let browser;
try {
    browser = await chromium.launch({ headless: true });
} catch (error) {
    if (process.env.STREAMDOWN_PROFILE_BROWSER !== 'chrome') throw error;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
}

try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(profileUrl);
    await page.waitForFunction(() => Boolean(window.__streamdownProfile));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

    const collectHeap = async () => {
        await cdp.send('HeapProfiler.collectGarbage');
        const { metrics } = await cdp.send('Performance.getMetrics');
        return metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value;
    };

    const fixtures = ['prose', 'math', 'mixed', 'references'];
    const modes = ['cache', 'bypass'];
    const results = [];

    for (const fixture of fixtures) {
        const runsByMode = { cache: [], bypass: [] };
        for (let repetition = 0; repetition < repetitions; repetition++) {
            const orderedModes =
                repetition % 2 === 0 ? modes : [...modes].reverse();
            for (const mode of orderedModes) {
                await page.evaluate(() => window.__streamdownProfile.dispose());
                const timing = await page.evaluate(
                    ({ fixture, mode }) =>
                        window.__streamdownProfile.run(
                            fixture,
                            mode,
                            1,
                            16,
                            64
                        ),
                    { fixture, mode }
                );
                runsByMode[mode].push(timing);
            }
        }
        for (const mode of modes) {
            await page.evaluate(() => window.__streamdownProfile.dispose());
            const baselineHeapBytes = await collectHeap();
            await page.evaluate(
                ({ fixture, mode }) =>
                    window.__streamdownProfile.run(fixture, mode, 1, 0, 64),
                { fixture, mode }
            );
            const mountedHeapBytes = await collectHeap();
            await page.evaluate(() => window.__streamdownProfile.dispose());
            const disposedHeapBytes = await collectHeap();
            const runs = runsByMode[mode];
            results.push({
                fixture,
                mode,
                repetitions,
                characters: runs[0].characters,
                chunks: runs[0].chunks,
                cadenceMs: runs[0].cadenceMs,
                updateWorkRunsMs: runs.map((run) =>
                    round(run.updateWorkMs)
                ),
                updateWorkMs: round(mean(runs.map((run) => run.updateWorkMs))),
                p95UpdateRunsMs: runs.map((run) =>
                    round(run.p95UpdateMs)
                ),
                p95UpdateMs: round(mean(runs.map((run) => run.p95UpdateMs))),
                maxUpdateMs: round(Math.max(...runs.map((run) => run.maxUpdateMs))),
                slowUpdates: runs.map((run) => run.slowUpdates),
                p95FrameRunsMs: runs.map((run) => round(run.p95FrameMs)),
                p95FrameMs: round(mean(runs.map((run) => run.p95FrameMs))),
                maxFrameMs: round(Math.max(...runs.map((run) => run.maxFrameMs))),
                slowFrames: runs.map((run) => run.slowFrames),
                longTasks: runs.map((run) => run.longTasks),
                longTaskMs: runs.map((run) => round(run.longTaskMs)),
                memory: {
                    baselineHeapBytes,
                    mountedHeapBytes,
                    disposedHeapBytes,
                    mountedDeltaBytes: mountedHeapBytes - baselineHeapBytes,
                    disposedDeltaBytes: disposedHeapBytes - baselineHeapBytes,
                },
            });
        }
    }

    const multiInstanceMemory = [];
    for (const mode of modes) {
        await page.evaluate(() => window.__streamdownProfile.dispose());
        const baselineHeapBytes = await collectHeap();
        await page.evaluate(
            (mode) =>
                window.__streamdownProfile.run('mixed', mode, 4, 0, 64),
            mode
        );
        const mountedHeapBytes = await collectHeap();
        await page.evaluate(() => window.__streamdownProfile.dispose());
        const disposedHeapBytes = await collectHeap();
        multiInstanceMemory.push({
            fixture: 'mixed',
            mode,
            instances: 4,
            baselineHeapBytes,
            mountedHeapBytes,
            disposedHeapBytes,
            mountedDeltaBytes: mountedHeapBytes - baselineHeapBytes,
            disposedDeltaBytes: disposedHeapBytes - baselineHeapBytes,
        });
    }

    console.log(
        JSON.stringify(
            {
                recordedAt: new Date().toISOString(),
                browser: await browser.version(),
                viewport: '1280x800',
                chunkSize: 64,
                cadenceMs: 16,
                results,
                multiInstanceMemory,
            },
            null,
            2
        )
    );
} finally {
    await browser.close();
    server?.kill('SIGTERM');
}
