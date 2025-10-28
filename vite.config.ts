import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        vue(),
        dts({
            include: ['index.ts', 'core.ts', 'src', 'lib'],
            outDir: 'dist',
            insertTypesEntry: true,
            // Roll up all d.ts into a single entry (reduces published size)
            rollupTypes: true,
        }),
    ],
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    build: {
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
        // Use esbuild minification (fast) with higher target for smaller output
        minify: 'esbuild',
        target: 'es2022',
    },
});
