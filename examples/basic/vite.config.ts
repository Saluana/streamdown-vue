import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';

// Local Vite config for the basic example so that .vue SFCs are processed.
// Running `bun run dev` (script: vite examples/basic) will pick this up
// because Vite searches the provided root directory for a config file.
export default defineConfig({
    plugins: [
        vue(),
        visualizer({
            template: 'treemap', // or 'sunburst'
            open: true,
            gzipSize: true,
            brotliSize: true,
            filename: 'bundle-analysis.html',
        }),
    ],
    server: {
        port: 5173,
        open: true,
    },
});
