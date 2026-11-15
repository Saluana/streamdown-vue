import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(
    process.env.STREAMDOWN_EVIDENCE_DIR ||
        resolve(root, 'artifacts/browser-regressions'),
);
await mkdir(output, { recursive: true });
const server = await createServer({
    configFile: resolve(root, 'vite.config.ts'),
    root,
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
        {
            name: 'regression-page',
            configureServer(server) {
                server.middlewares.use('/__regressions', (_req, res) => {
                    res.setHeader('Content-Type', 'text/html');
                    res.end(
                        '<!doctype html><html><body><div id="app"></div><script type="module" src="/tests/browser-fixture.ts"></script></body></html>',
                    );
                });
            },
        },
    ],
});
let browser;
const results = [];
try {
    await server.listen();
    const address = server.httpServer.address();
    browser = await (
        process.env.STREAMDOWN_BROWSER === 'webkit' ? webkit : chromium
    ).launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/__regressions`);
    await page.waitForFunction(() => Boolean(window.__streamdownRegressions));
    for (const name of [
        'highlighting',
        'grammar',
        'renderer',
        'overrides',
        'completedBlocks',
        'mermaid',
        'hydration',
    ]) {
        try {
            const evidence = await page.evaluate(
                (name) => window.__streamdownRegressions(name),
                name,
            );
            results.push({ name, passed: true, evidence });
        } catch (error) {
            results.push({ name, passed: false, error: String(error) });
            await page.screenshot({ path: resolve(output, `${name}.png`) });
        }
    }
} finally {
    await browser?.close();
    await server.close();
    await writeFile(
        resolve(output, 'results.json'),
        JSON.stringify(results, null, 2) + '\n',
    );
}
console.log(JSON.stringify(results, null, 2));
assert(
    results.length === 7 && results.every((result) => result.passed),
    `Browser regressions failed; see ${output}`,
);
