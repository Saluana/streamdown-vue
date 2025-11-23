import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { transform } from 'lightningcss';

// Read source CSS
const css = readFileSync('src/style.css', 'utf-8');

// Minify using lightningcss (Vite's default CSS minifier)
const { code } = transform({
  filename: 'style.css',
  code: Buffer.from(css),
  minify: true,
});

// Ensure dist directory exists
mkdirSync('dist', { recursive: true });

// Write minified CSS
writeFileSync('dist/style.css', code);

console.log('✓ CSS minified and written to dist/style.css');
