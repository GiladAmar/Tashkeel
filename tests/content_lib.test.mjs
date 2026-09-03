import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {hasArabic, isMostlyDiacritized, segmentRange, nodeSegment, collectSegments} from '../content_lib.mjs';
import {applyWithRegistry} from '../content_runtime.mjs';

// content_runtime's registry hangs off `window`
global.window = {};

describe('hasArabic', () => {
    test('detects Arabic letters', () => {
        assert.ok(hasArabic('سلام'));
        assert.ok(hasArabic('abc سلام xyz'));
    });
    test('rejects Latin, digits, and tashkeel-only text', () => {
        assert.ok(!hasArabic('hello 123'));
        assert.ok(!hasArabic('ًٌٍَُِ'));
        assert.ok(!hasArabic(''));
    });
});

describe('isMostlyDiacritized', () => {
    test('unvocalised Arabic is not skipped', () => {
        assert.equal(isMostlyDiacritized('وقالت مجلة نيوزويك إن الوضع عادي'), false);
    });
    test('fully vocalised Arabic is skipped', () => {
        assert.equal(isMostlyDiacritized('وَقَالَتْ مَجَلَّةُ'), true);
    });
    test('lightly vocalised learning text is still processed', () => {
        // one vocalised word inside a long bare sentence
        assert.equal(isMostlyDiacritized('وَقَالَتْ is one word inside نص طويل بدون تشكيل إطلاقا هنا كثير جدا'), false);
    });
    test('judged per word: a vocalised short word next to bare words is processed', () => {
        // per-letter ratios misfire here; per-word keeps it below the threshold
        assert.equal(isMostlyDiacritized('عَلَى ذلك'), false);
        assert.equal(isMostlyDiacritized('بِسَمِ الله بدون تشكيل إطلاقا هنا'), false);
    });
    test('no Arabic means nothing to skip', () => {
        assert.equal(isMostlyDiacritized('hello world 123'), false);
        assert.equal(isMostlyDiacritized(''), false);
    });
});

describe('collectSegments already-vocalised skip', () => {
    const node = (text) => ({textContent: text});

    test('fully vocalised nodes are skipped and counted', () => {
        const nodes = [node('وَقَالَتْ مَجَلَّةُ'), node('نص جديد بدون تشكيل')];
        const {segments, alreadyDotted} = collectSegments(nodes, null);
        assert.equal(alreadyDotted, 1);
        assert.deepEqual(segments.map(s => s.text), ['نص جديد بدون تشكيل']);
    });

    test('the skip is judged on the selected part, not the whole node', () => {
        // A node whose first sentence was vocalised earlier: selecting the
        // still-bare second sentence must be processed (regression: node
        // identity and whole-text skips blocked this forever).
        const text = 'الْجُمْلَةُ الْأُولَى مُشَكَّلَةٌ. جملة ثانية عادية.';
        const secondStart = text.indexOf('جملة ثانية');
        const n = node(text);
        const range = {startContainer: n, endContainer: n,
            startOffset: secondStart, endOffset: text.length};
        const {segments, alreadyDotted} = collectSegments([n], range);
        assert.equal(alreadyDotted, 0);
        assert.deepEqual(segments.map(s => s.text), ['جملة ثانية عادية.']);
    });

    test('selecting the already-vocalised part of a node is skipped', () => {
        const text = 'الْجُمْلَةُ الْأُولَى مُشَكَّلَةٌ. جملة ثانية عادية.';
        const dottedEnd = text.indexOf('.') + 1;
        const n = node(text);
        const range = {startContainer: n, endContainer: n,
            startOffset: 0, endOffset: dottedEnd};
        const {segments, alreadyDotted} = collectSegments([n], range);
        assert.equal(alreadyDotted, 1);
        assert.equal(segments.length, 0);
    });
});

describe('segmentRange', () => {
    test('middle node is fully covered', () => {
        assert.deepEqual(segmentRange(10, false, false, 3, 7), {start: 0, end: 10});
    });
    test('start container starts at the range offset', () => {
        assert.deepEqual(segmentRange(10, true, false, 3, 7), {start: 3, end: 10});
    });
    test('end container ends at the range offset', () => {
        assert.deepEqual(segmentRange(10, false, true, 3, 7), {start: 0, end: 7});
    });
    test('single node covered by both ends', () => {
        assert.deepEqual(segmentRange(10, true, true, 3, 7), {start: 3, end: 7});
    });
    test('element-container offsets (Ctrl+A) are clamped to the text length', () => {
        // With select-all the range containers are elements and offsets are
        // child indices, which can exceed a short text node's length.
        assert.deepEqual(segmentRange(4, true, true, 0, 57), {start: 0, end: 4});
    });
    test('end never precedes start', () => {
        assert.deepEqual(segmentRange(10, true, true, 8, 2), {start: 8, end: 8});
    });
});

describe('nodeSegment', () => {
    test('splits prefix / middle / suffix', () => {
        const seg = nodeSegment('ابج سلام دهو', true, true, 4, 8);
        assert.deepEqual(seg, {prefix: 'ابج ', middle: 'سلام', suffix: ' دهو'});
    });
    test('returns null when the selected part has no Arabic', () => {
        assert.equal(nodeSegment('سلام hello', true, true, 5, 10), null);
        assert.equal(nodeSegment('plain latin text', false, false, 0, 0), null);
    });
    test('whole node when it is not a boundary container', () => {
        const seg = nodeSegment('سلام', false, false, 99, 99);
        assert.deepEqual(seg, {prefix: '', middle: 'سلام', suffix: ''});
    });
    test('reassembly is lossless', () => {
        const text = 'قبل سلام بعد';
        const seg = nodeSegment(text, true, true, 4, 8);
        assert.equal(seg.prefix + seg.middle + seg.suffix, text);
    });
});

describe('applyWithRegistry', () => {
    function target(initial) {
        const t = {value: initial};
        return {t, read: () => t.value, write: v => { t.value = v; }};
    }

    test('applies, records, and rolls back', () => {
        const {t, read, write} = target('سلام');
        const rollback = applyWithRegistry(t, read, write, 'سلام', 'سَلَام');
        assert.equal(t.value, 'سَلَام');
        rollback();
        assert.equal(t.value, 'سلام');
    });

    test('stale snapshot applies nothing', () => {
        const {t, read, write} = target('changed meanwhile');
        const rollback = applyWithRegistry(t, read, write, 'original snapshot', 'dotted');
        assert.equal(rollback, null);
        assert.equal(t.value, 'changed meanwhile');
    });

    test('edits between runs become the new original (undo keeps user edits)', () => {
        const {t, read, write} = target('ابج');
        applyWithRegistry(t, read, write, 'ابج', 'اَبَج');
        // user edits after the first run
        t.value = 'اَبَج ومزيد';
        // second run over the edited text
        applyWithRegistry(t, read, write, 'اَبَج ومزيد', 'اَبَج وَمَزِيد');
        // Remove tashkeel must give back the EDITED text, not the pre-edit state
        const record = global.window.__tashkeelOriginals.get(t);
        assert.equal(record.original, 'اَبَج ومزيد');
        assert.equal(record.written, 'اَبَج وَمَزِيد');
    });

    test('rollback of a re-run restores the pre-run text without deleting the record', () => {
        const {t, read, write} = target('ابج');
        applyWithRegistry(t, read, write, 'ابج', 'first');
        const rollback = applyWithRegistry(t, read, write, 'first', 'second');
        rollback();
        assert.equal(t.value, 'first');
        const record = global.window.__tashkeelOriginals.get(t);
        assert.equal(record.written, 'first');
        assert.equal(record.original, 'ابج');
    });

    test('rollback is a no-op when the target changed after the write', () => {
        const {t, read, write} = target('ابج');
        const rollback = applyWithRegistry(t, read, write, 'ابج', 'dotted');
        t.value = 'user typed over it';
        rollback();
        assert.equal(t.value, 'user typed over it');
    });
});
