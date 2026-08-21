// @vitest-environment happy-dom

import type Format from '../block/base/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstContent(muya: Muya): Format {
    return muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
}

describe('unicode editor input', () => {
    it('preserves complex symbols when another edit lands in the same frame', async () => {
        const muya = bootMuya('A\n');
        const content = firstContent(muya);
        const symbol = '\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDCBB';

        content.text = `A${symbol}`;
        content.text = `A${symbol}x`;

        await vi.waitFor(() => expect(muya.getMarkdown()).toContain(`A${symbol}x`));

        muya.undo();
        expect(muya.getMarkdown()).toContain('A');
        muya.redo();
        expect(muya.getMarkdown()).toContain(`A${symbol}x`);
    });

    it('waits for a complete surrogate pair before recording input', async () => {
        const muya = bootMuya('A\n');
        const content = firstContent(muya);

        content.text = 'A\uD83C';
        expect(content.text).toBe('A');

        content.text = 'A\uD83C\uDFE0';
        await vi.waitFor(() => expect(muya.getMarkdown()).toContain('A\uD83C\uDFE0'));
    });
});
