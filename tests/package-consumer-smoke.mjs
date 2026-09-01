import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(
    readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
);
const tempRoot = mkdtempSync(path.join(tmpdir(), 'streamdown-vue-smoke-'));

try {
    const packResult = JSON.parse(
        execFileSync(
            'npm',
            ['pack', '--json', '--pack-destination', tempRoot],
            { cwd: packageRoot, encoding: 'utf8' }
        )
    )[0];
    const packedFiles = new Set(packResult.files.map((file) => file.path));
    for (const expected of [
        'dist/index.es.js',
        'dist/index.cjs',
        'dist/core.es.js',
        'dist/core.cjs',
        'dist/index.d.ts',
        'dist/core.d.ts',
        'dist/style.css',
    ]) {
        assert(packedFiles.has(expected), `tarball is missing ${expected}`);
    }

    const consumerRoot = path.join(tempRoot, 'consumer');
    mkdirSync(consumerRoot);
    const tarball = path.join(tempRoot, packResult.filename);
    writeFileSync(
        path.join(consumerRoot, 'package.json'),
        JSON.stringify(
            {
                private: true,
                type: 'module',
                dependencies: {
                    'streamdown-vue': `file:${tarball}`,
                    vue: packageJson.devDependencies.vue,
                },
            },
            null,
            2
        )
    );
    execFileSync(
        'npm',
        ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
        { cwd: consumerRoot, stdio: 'pipe' }
    );

    const smokeScript = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as esm from 'streamdown-vue';
import * as core from 'streamdown-vue/core';

const require = createRequire(import.meta.url);
const cjs = require('streamdown-vue');
const cjsCore = require('streamdown-vue/core');
assert.equal(typeof esm.StreamMarkdown, 'object');
assert.equal(typeof core.parseBlocks, 'function');
assert.equal(typeof cjs.StreamMarkdown, 'object');
assert.equal(typeof cjsCore.parseBlocks, 'function');

const html = await renderToString(
    createSSRApp(esm.StreamMarkdown, { content: '# Packaged consumer' })
);
assert.match(html, /data-streamdown="h1"/);
assert.match(html, /Packaged consumer/);

const styleUrl = import.meta.resolve('streamdown-vue/style.css');
const css = readFileSync(fileURLToPath(styleUrl), 'utf8');
assert.match(css, /streamdown-vue/);
`;
    writeFileSync(path.join(consumerRoot, 'smoke.mjs'), smokeScript);
    execFileSync(process.execPath, ['smoke.mjs'], {
        cwd: consumerRoot,
        stdio: 'pipe',
    });

    console.log('✓ packed ESM, CommonJS, declarations, CSS, and SSR consumer');
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
}
