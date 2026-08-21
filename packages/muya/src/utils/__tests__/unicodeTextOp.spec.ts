import diff from 'fast-diff';
import * as otText from 'ot-text-unicode';
import { describe, expect, it } from 'vitest';
import { diffToTextOp, hasUnpairedSurrogate } from '../index';

const symbols = [
    '\uD83C\uDFE0',
    '\u2600\uFE0F',
    '\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDCBB',
    '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66',
    '\uD83C\uDDE8\uD83C\uDDF3',
    '1\uFE0F\u20E3',
    'e\u0301',
    '\uD842\uDFB7',
];

describe('unicode text operations', () => {
    it.each(symbols)('keeps %s intact across consecutive edits', (symbol) => {
        const before = `A${symbol}`;
        const after = `${before}x`;
        const operation = diffToTextOp(diff(before, after));

        expect(otText.type.apply(before, operation)).toBe(after);
        expect(operation.every(component =>
            typeof component === 'number'
            || !hasUnpairedSurrogate(typeof component === 'string' ? component : component.d),
        )).toBe(true);
    });

    it('counts every code point in joined emoji sequences', () => {
        const family = '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66';

        expect(diffToTextOp(diff(`A${family}`, `A${family}x`))).toEqual([8, 'x']);
    });

    it('detects incomplete surrogate-pair input states', () => {
        expect(hasUnpairedSurrogate('\uD83C')).toBe(true);
        expect(hasUnpairedSurrogate('\uDFE0')).toBe(true);
        expect(hasUnpairedSurrogate('\uD83C\uDFE0')).toBe(false);
        expect(hasUnpairedSurrogate('\uD83D\uDC69\uD83C\uDFFD\u200D\uD83D\uDCBB')).toBe(false);
    });
});
