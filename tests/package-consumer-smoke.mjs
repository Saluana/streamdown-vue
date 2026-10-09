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
// Bracket math beside literal code: only the two prose formulas become math.
const latexBesideCode = [
    'Literal examples: `\\[inline\\]` and `` \\[double`tick\\] ``.',
    '',
    '    \\[indented\\]',
    '',
    '~~~text',
    '\\[fenced\\]',
    '~~~',
    '',
    'A code example next to math: `\\[neighbor\\]` then \\[x + 1\\].',
    '',
    '\\[ a^2 + b^2 = c^2 \\]',
].join('\n');
const literalCodeHtml = [
    '>\\[inline\\]</code>',
    '>\\[double`tick\\]</code>',
    '>\\[neighbor\\]</code>',
    '>\\[indented\\]\n</code></pre>',
    '>\\[fenced\\]\n</code></pre>',
];
const npmEnvironment = {
    ...process.env,
    npm_config_dry_run: 'false',
    NPM_CONFIG_DRY_RUN: 'false',
};

try {
    const packResult = JSON.parse(
        execFileSync(
            'npm',
            ['pack', '--json', '--pack-destination', tempRoot],
            { cwd: packageRoot, encoding: 'utf8', env: npmEnvironment }
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
        { cwd: consumerRoot, stdio: 'pipe', env: npmEnvironment }
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

const cjsVue = require('vue');
const cjsServer = require('vue/server-renderer');
for (const [StreamMarkdown, createApp, render] of [
    [esm.StreamMarkdown, createSSRApp, renderToString],
    [cjs.StreamMarkdown, cjsVue.createSSRApp, cjsServer.renderToString],
]) {
    const latexHtml = await render(
        createApp(StreamMarkdown, { content: ${JSON.stringify(latexBesideCode)} })
    );
    for (const fragment of ${JSON.stringify(literalCodeHtml)}) {
        assert(latexHtml.includes(fragment), 'literal code lost: ' + fragment);
    }
    assert.equal(latexHtml.match(/katex-display/g)?.length, 2);
    assert(!latexHtml.includes('katex-error'));
}

const styleUrl = import.meta.resolve('streamdown-vue/style.css');
const css = readFileSync(fileURLToPath(styleUrl), 'utf8');
assert.match(css, /streamdown-vue/);
`;
    writeFileSync(path.join(consumerRoot, 'smoke.mjs'), smokeScript);
    execFileSync(process.execPath, ['smoke.mjs'], {
        cwd: consumerRoot,
        stdio: 'pipe',
    });

    console.log(
        '✓ packed ESM, CommonJS, declarations, CSS, SSR, and literal-code math consumer'
    );
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
}
