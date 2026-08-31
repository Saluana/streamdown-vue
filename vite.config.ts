import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    // Declaration files are emitted by `bun run build:types` before Vite runs.
    // Keeping type generation in one place avoids a redundant declaration plugin
    // and API Extractor compatibility issues with newer TypeScript versions.
    plugins: [vue()],
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    build: {
        // `build:types` writes declarations to dist before Vite runs. Preserve them.
        emptyOutDir: false,
        lib: {
            entry: {
                index: 'index.ts',
                core: 'core.ts',
            },
            name: 'StreamdownVue',
            formats: ['es', 'cjs'],
            fileName: (format: string, entryName: string) =>
                format === 'es'
                    ? `${entryName}.es.js`
                    : `${entryName}.cjs.js`,
        },
        rollupOptions: {
            external: [
                'vue',
                'mermaid',
                'katex',
                'shiki',
                /^shiki\//,
                /^@shikijs\/themes\//,
                /^@shikijs\/langs\//,
                'marked',
                'remark-parse',
                'remark-gfm',
                'remark-math',
                'remark-rehype',
                'rehype-katex',
                'unified',
            ],
            output: {
                globals: { vue: 'Vue' },
                // Keep only license comments we must retain (lucide, etc.)
                banner: '/**\n * streamdown-vue (c) 2025 @Saluana\n * MIT Licensed. Contains portions with their own licenses (see LICENSE).\n */',
            },
        },
        // Disable source maps for published build to reduce package size.
        sourcemap: false,
        // Vite 8 uses Oxc for minification; avoid the deprecated esbuild fallback.
        minify: 'oxc',
        target: 'es2022',
    },
});
