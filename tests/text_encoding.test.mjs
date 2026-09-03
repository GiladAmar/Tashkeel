import {test, describe, before} from 'node:test';
import assert from 'node:assert/strict';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as tf from '@tensorflow/tfjs-core';
// wasm backend: same numerics as in the extension, much faster than cpu
import '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-cpu';
import {loadModelFromDisk} from '../scripts/model_loader.mjs';
import {MODEL_LEN, MAX_INPUT, remove_tashkeel, split_windows, diacritize, diacritize_batch} from '../text_encoding.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const TASHKEEL = /[ً-ْ]/;

// The reference sentence, verified byte-identical to the original Shakkala
// (tf-keras / Python) inference in arabic_model_build/sanity.txt.
const REF_IN = 'وقالت مجلة نيوزويك الأمريكية إن الوضع في المنطقة يزداد تعقيدا';
const REF_OUT = 'وَقَالَتْ مَجَلَّةُ نُيُوزَوِيكَ الْأَمْرِيكِيَّةِ إنَّ الْوَضْعَ فِي الْمِنْطَقَةِ يَزْدَادُ تَعْقِيدًا';

assert.ok(await tf.setBackend('wasm'), 'wasm backend must initialize — tests must not silently fall back to cpu');
await tf.ready();
assert.equal(tf.getBackend(), 'wasm');

function assertValidWindows(windows, text) {
    // Every window must fit the model's usable length, or the contract
    // (len < MODEL_LEN) is violated and the padded tensor would truncate.
    for (const w of windows)
        assert.ok(Array.from(w).length <= MAX_INPUT,
            `window length ${Array.from(w).length} exceeds MAX_INPUT ${MAX_INPUT}`);
    // Losslessness: concatenating the windows must reproduce the input exactly.
    assert.equal(windows.join(''), text);
}

describe('split_windows', () => {
    test('short text is a single window', () => {
        assertValidWindows(split_windows(REF_IN), REF_IN);
        assert.equal(split_windows(REF_IN).length, 1);
    });

    test('empty string yields no windows', () => {
        assert.deepEqual(split_windows(''), []);
    });

    test('a single word longer than a window still splits and round-trips', () => {
        const text = 'ا'.repeat(700);
        const windows = split_windows(text);
        assert.ok(windows.length >= 3, `expected multiple windows, got ${windows.length}`);
        assertValidWindows(windows, text);
    });

    test('breaks at spaces so words are never split', () => {
        const text = Array(80).fill('المنطقة').join(' '); // ~640 chars, many words
        const windows = split_windows(text);
        assert.ok(windows.length >= 2);
        assertValidWindows(windows, text);
        // every window except possibly the last ends at a space boundary
        for (let i = 0; i < windows.length - 1; i++)
            assert.ok(windows[i].endsWith(' '), `window ${i} must break after a space`);
    });

    test('lengths around the window boundary round-trip', () => {
        for (const n of [1, 313, 314, 315, 628, 629, 630]) {
            const bare = 'ب'.repeat(n);
            assertValidWindows(split_windows(bare), bare);
            const withNeighbours = 'سلام ' + 'ب'.repeat(n) + ' عالم';
            assertValidWindows(split_windows(withNeighbours), withNeighbours);
        }
    });
});

describe('remove_tashkeel', () => {
    test('strips all tashkeel (harakat, tanwin, shadda, sukun)', () => {
        assert.equal(remove_tashkeel('وَقَالَتْ'), 'وقالت');
        assert.equal(remove_tashkeel('مَجَلَّةُ'), 'مجلة');
        assert.equal(remove_tashkeel(REF_OUT), REF_IN);
    });
    test('preserves superscript alef (orthographic) and punctuation', () => {
        // U+0670 is part of the spelling, not tashkeel we add — it survives.
        assert.equal(remove_tashkeel('هَٰذَا، نعم.'), 'هٰذا، نعم.');
    });
    test('leaves unmarked text alone', () => {
        const text = 'سلام hello 123';
        assert.equal(remove_tashkeel(text), text);
    });
});

describe('end-to-end with the real model', () => {
    let model;

    before(async () => {
        model = await loadModelFromDisk(join(repoRoot, 'model'));
    });

    test('matches the Python reference output exactly', async () => {
        const out = await diacritize(tf, model, REF_IN);
        assert.equal(out, REF_OUT);
    });

    test('short MSA sentences round-trip and receive tashkeel', async () => {
        const samples = [
            'الطقس اليوم حار وجاف في معظم المناطق',
            'أعلنت الحكومة عن خطة جديدة لتطوير التعليم',
            'فاز الفريق بثلاثة أهداف في مباراة الأمس',
        ];
        for (const text of samples) {
            const out = await diacritize(tf, model, text);
            assert.ok(TASHKEEL.test(out), 'output should contain tashkeel marks');
            assert.equal(remove_tashkeel(out), text, 'stripping the marks restores the input');
        }
    });

    test('a paragraph longer than one window round-trips (windowing)', async () => {
        const text = Array(15).fill('الطقس اليوم حار وجاف في معظم مناطق البلاد').join(' ');
        assert.ok(text.length > MAX_INPUT, 'sanity: this must exceed one window');
        const out = await diacritize(tf, model, text);
        assert.equal(remove_tashkeel(out), text);
        assert.ok(TASHKEEL.test(out));
    });

    test('a single word longer than a window does not crash and round-trips', async () => {
        const blob = [
            Array(50).fill('أخبار').join(' '),
            'https://www.aljazeera.net/news/2024/1/1/example',
            'ا'.repeat(400),
            'عنوان رئيسي: شيء ما حدث صباح اليوم.',
        ].join(' ');
        const out = await diacritize(tf, model, blob);
        assert.equal(remove_tashkeel(out), remove_tashkeel(blob));
    });

    test('diacritize_batch: every segment aligns back to its own text and gets tashkeel', async () => {
        const texts = [
            'الطقس اليوم حار وجاف في معظم المناطق',
            'عنوان رئيسي: شيء ما حدث اليوم.',
            'فقرة أخرى بنص عربي عادي تماما.',
        ];
        const batched = await diacritize_batch(tf, model, texts);
        assert.equal(batched.length, texts.length);
        for (let i = 0; i < texts.length; i++) {
            assert.equal(remove_tashkeel(batched[i]), texts[i], `segment ${i} must round-trip exactly`);
            assert.ok(TASHKEEL.test(batched[i]), `segment ${i} should get tashkeel`);
        }
    });

    test('one huge segment (paste-page case) round-trips exactly', async () => {
        const text = Array(400).fill('هم جزء من جهود الجمعية الوطنية لحماية الطبيعة').join(' ');
        const out = await diacritize(tf, model, text);
        assert.equal(remove_tashkeel(out), text);
        assert.ok(TASHKEEL.test(out));
    });

    test('characters are preserved exactly, including newlines and tabs', async () => {
        const text = 'السطر الأول\nالسطر الثاني\tالنهاية';
        const out = await diacritize(tf, model, text);
        assert.equal(remove_tashkeel(out), text);
    });

    test('Latin-only text is returned unchanged', async () => {
        const latin = ('lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)).trim();
        const out = await diacritize(tf, model, latin);
        assert.equal(out, latin);
    });

    test('digits and punctuation pass through verbatim', async () => {
        const text = 'ارتفع العدد إلى 1,234 شخصا (بنسبة 5%)';
        const out = await diacritize(tf, model, text);
        assert.equal(remove_tashkeel(out), text);
    });

    test('no tensor leaks across calls', async () => {
        await diacritize(tf, model, 'اختبار الذاكرة الأول');
        const before = tf.memory().numTensors;
        await diacritize_batch(tf, model, ['اختبار الذاكرة الثاني', 'وواحد آخر']);
        assert.equal(tf.memory().numTensors, before);
    });
});
