import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        vue(),
        dts({
            include: ['index.ts', 'src', 'lib'],
            outDir: 'dist',
            insertTypesEntry: true,
        }),
    ],
    build: {
        lib: {
            entry: 'index.ts',
            name: 'StreamdownVue',
            formats: ['es', 'cjs'],
            fileName: (format: string) =>
                format === 'es' ? 'index.es.js' : 'index.cjs.js',
        },
        rollupOptions: {
            external: [
                'vue',
                'mermaid',
                'katex',
                'shiki',
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
            },
        },
        sourcemap: true,
        minify: 'esbuild',
        target: 'es2019',
    },
});
