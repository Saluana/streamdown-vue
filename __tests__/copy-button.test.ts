import { describe, expect, it } from 'bun:test';
import { writeClipboardText } from '../src/components/CopyButton';

describe('writeClipboardText', () => {
    it('writes the exact code text', async () => {
        const writes: string[] = [];
        const copied = await writeClipboardText('const answer = 42;', {
            async writeText(text) {
                writes.push(text);
            },
        });

        expect(copied).toBe(true);
        expect(writes).toEqual(['const answer = 42;']);
    });

    it('does not report success without clipboard support', async () => {
        expect(await writeClipboardText('code', undefined)).toBe(false);
    });

    it('does not report success when clipboard writing fails', async () => {
        const copied = await writeClipboardText('code', {
            async writeText() {
                throw new Error('permission denied');
            },
        });

        expect(copied).toBe(false);
    });

    it('does not write empty text', async () => {
        let called = false;
        const copied = await writeClipboardText('', {
            async writeText() {
                called = true;
            },
        });

        expect(copied).toBe(false);
        expect(called).toBe(false);
    });
});
