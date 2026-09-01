import { describe, expect, it } from 'bun:test';
import { createCodeDownload } from '../src/components/DownloadButton';

describe('createCodeDownload', () => {
    it('preserves exact code content and MIME type', async () => {
        const file = createCodeDownload('console.log("hello");', 'javascript');

        expect(file?.filename).toBe('file.js');
        expect(file?.blob.type).toBe('text/plain;charset=utf-8');
        expect(await file?.blob.text()).toBe('console.log("hello");');
    });

    it('maps common language aliases to filenames', () => {
        expect(createCodeDownload('x', 'ts')?.filename).toBe('file.ts');
        expect(createCodeDownload('x', 'python')?.filename).toBe('file.py');
        expect(createCodeDownload('x', 'markdown')?.filename).toBe('file.md');
    });

    it('uses txt for unknown languages', () => {
        expect(createCodeDownload('x', 'unknown')?.filename).toBe('file.txt');
    });

    it('honors an explicit filename', () => {
        expect(createCodeDownload('x', 'ts', 'example.custom')?.filename).toBe(
            'example.custom'
        );
    });

    it('does not create empty downloads', () => {
        expect(createCodeDownload('', 'ts')).toBeNull();
    });
});
