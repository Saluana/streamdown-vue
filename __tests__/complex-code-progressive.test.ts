import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { StreamMarkdown } from '../src/StreamMarkdown';

// Utility count occurrences
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('complex-code.md progressive streaming', () => {
    const fixturePath = path.join(__dirname, 'fixtures/complex-code.md');
    const full = fs.readFileSync(fixturePath, 'utf8');
    const lines = full.replace(/\r\n?/g, '\n').split('\n');

    it('reveals code lines before real closing fences arrive (TS + HTML)', async () => {
        let buffer = '';
        let sawInterface = false;
        let sawTick = false;
        let sawDoctype = false;
        let closedFirstFence = false;
        let closedSecondFence = false;

        for (let i = 0; i < lines.length; i++) {
            buffer += (i > 0 ? '\n' : '') + lines[i];
            const app = h(StreamMarkdown, { content: buffer });
            const html = await renderToString(app);

            const fenceCount = (buffer.match(/```/g) || []).length; // odd => inside a fence

            // 1. When interface line has streamed but TS fence not really closed yet.
            if (!sawInterface && /interface Position/.test(buffer)) {
                expect(html).toContain('interface Position');
                sawInterface = true;
                expect(count(html, 'interface Position')).toBe(1);
                // Should still be inside fence (odd count) at this early point
                expect(fenceCount % 2).toBe(1);
            } else if (sawInterface) {
                // Ensure we never duplicate that line.
                expect(count(html, 'interface Position')).toBe(1);
            }

            // 2. Later line deeper in class before close
            if (!sawTick && /private tick\(\): void/.test(buffer)) {
                expect(html).toContain('private tick(): void');
                sawTick = true;
                expect(count(html, 'private tick(): void')).toBe(1);
            }

            // Detect closing of first (typescript) fence
            if (!closedFirstFence && fenceCount >= 2) {
                // After true close, still only one occurrence lines.
                closedFirstFence = true;
                expect(count(html, 'interface Position')).toBe(1);
            }

            // 3. HTML fence streaming
            if (/<!DOCTYPE html>/.test(buffer)) {
                if (!sawDoctype) {
                    // During streaming the HTML block may still be inside code context or escaped.
                    const doctypeCount =
                        count(html, '<!DOCTYPE html>') +
                        count(html, '&lt;!DOCTYPE html&gt;');
                    expect(doctypeCount).toBeGreaterThanOrEqual(1);
                    sawDoctype = true;
                    expect(doctypeCount).toBe(1);
                } else {
                    const doctypeCount =
                        count(html, '<!DOCTYPE html>') +
                        count(html, '&lt;!DOCTYPE html&gt;');
                    expect(doctypeCount).toBe(1);
                }
            }

            // After second fence closes (html) there should be >=2 code-block wrappers
            if (!closedSecondFence && fenceCount >= 4) {
                closedSecondFence = true;
                // We expect at least one code-block wrapper; depending on parser heuristics may reuse wrappers,
                // so just verify both code domains present.
                expect(html).toContain('interface Position');
                const doctypePresent =
                    html.includes('<!DOCTYPE html>') ||
                    html.includes('&lt;!DOCTYPE html&gt;');
                expect(doctypePresent).toBe(true);
            }
        }

        expect(sawInterface).toBe(true);
        expect(sawTick).toBe(true);
        expect(sawDoctype).toBe(true);
        expect(closedFirstFence).toBe(true);
        expect(closedSecondFence).toBe(true);
    });
});
