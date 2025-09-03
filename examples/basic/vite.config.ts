import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Local Vite config for the basic example so that .vue SFCs are processed.
// Running `bun run dev` (script: vite examples/basic) will pick this up
// because Vite searches the provided root directory for a config file.
export default defineConfig({
    plugins: [vue()],
    server: {
        port: 5173,
        open: true,
    },
});
