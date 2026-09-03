// Arabic tashkeel encoding/inference for the Shakkala model (a char-level
// BiLSTM tagger converted to TensorFlow.js). Unlike a word-packed niqqud
// model, Shakkala is fed the raw character stream: each Unicode character
// maps to an embedding id, and the model predicts one diacritic class per
// position. See arabic_model_build/CONTRACT.md for the full I/O contract.
import {INPUT_VOCAB, UNK_ID, DIACRITIC} from './arabic_dict.mjs';

// The model has 315 timesteps; the contract requires len(input) < 315, so a
// single prediction covers at most 314 characters. Longer text is split into
// windows at word boundaries and stitched back together.
const MODEL_LEN = 315;
const MAX_INPUT = MODEL_LEN - 1;

// Windows are batched into the model this many at a time. Three stacked
// BiLSTM layers over 315 steps are heavier per row than the niqqud model, so
// the batch is kept modest to bound service-worker memory.
const ROWS_PER_PREDICT = 32;

// Segments are grouped into chunks of about this many characters before being
// handed to diacritize_batch, so one huge paste can't blow memory at once.
const CHARS_PER_CHUNK = 4000;

// Harakat only attach to Arabic letters. Guarding the append on this range
// guarantees punctuation, digits, Latin and whitespace pass through verbatim
// even if the model predicts a stray class for them.
const ARABIC_LETTER_RE = /[ء-يٱ]/;

// The tashkeel this extension (and Shakkala) produce: tanwin, the three short
// vowels, shadda and sukun (U+064B..U+0652). Stripped before re-predicting so
// already-vocalised text is re-diacritized from bare letters rather than
// stacking marks. Superscript alef (U+0670) is orthographic, not tashkeel we
// add, so it is left in place.
const TASHKEEL_RE = /[ً-ْ]/g;

function remove_tashkeel(text) {
    return text.replace(TASHKEEL_RE, '');
}

// Split text into windows of at most MAX_INPUT code points. Breaks are taken
// after the last space that fits, so a word is never split unless it alone is
// longer than a window (e.g. a URL). Concatenating the windows reproduces the
// input exactly.
function split_windows(text) {
    const chars = Array.from(text);
    if (chars.length === 0) return [];
    if (chars.length <= MAX_INPUT) return [text];
    const windows = [];
    let start = 0;
    while (start < chars.length) {
        let end = Math.min(start + MAX_INPUT, chars.length);
        if (end < chars.length) {
            let brk = end;
            while (brk > start && chars[brk - 1] !== ' ') brk--;
            if (brk > start) end = brk; // break just after a space
        }
        windows.push(chars.slice(start, end).join(''));
        start = end;
    }
    return windows;
}

// Run one batch of windows through the model and reconstruct each diacritized
// string. Windows are right-padded with the pad id (0) to MODEL_LEN.
async function predict_rows(tf, model, windows) {
    const batch = windows.length;
    const charArrs = windows.map(w => Array.from(w));
    const data = new Float32Array(batch * MODEL_LEN); // zero == <PAD>
    for (let b = 0; b < batch; b++) {
        const chars = charArrs[b];
        for (let i = 0; i < chars.length; i++) {
            const id = INPUT_VOCAB[chars[i]];
            data[b * MODEL_LEN + i] = id === undefined ? UNK_ID : id;
        }
    }
    const input = tf.tensor2d(data, [batch, MODEL_LEN], 'float32');
    const logits = model.predict(input);        // [batch, MODEL_LEN, 28]
    const cls = tf.argMax(logits, -1);           // [batch, MODEL_LEN]
    const clsData = await cls.data();
    tf.dispose([input, logits, cls]);

    const results = new Array(batch);
    for (let b = 0; b < batch; b++) {
        const chars = charArrs[b];
        let out = '';
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            // Only vowel an Arabic letter; everything else is emitted as-is.
            out += ARABIC_LETTER_RE.test(ch)
                ? ch + DIACRITIC[clsData[b * MODEL_LEN + i]]
                : ch;
        }
        results[b] = out;
    }
    return results;
}

// Diacritize an array of segment texts, returning an array of results aligned
// to the input. Existing tashkeel is stripped first; each segment is windowed
// and all windows across all segments are batched together for throughput,
// then stitched back per segment.
async function diacritize_batch(tf, model, texts) {
    const perText = texts.map(() => []);
    const windows = [];
    const owner = [];
    texts.forEach((text, ti) => {
        for (const w of split_windows(remove_tashkeel(text))) {
            windows.push(w);
            owner.push(ti);
        }
    });
    for (let i = 0; i < windows.length; i += ROWS_PER_PREDICT) {
        const slice = windows.slice(i, i + ROWS_PER_PREDICT);
        const res = await predict_rows(tf, model, slice);
        for (let j = 0; j < res.length; j++)
            perText[owner[i + j]].push(res[j]);
    }
    return texts.map((_, ti) => perText[ti].join(''));
}

async function diacritize(tf, model, text) {
    const [result] = await diacritize_batch(tf, model, [text]);
    return result;
}

// Group segments into chunks of ~charsPerChunk characters (never splitting a
// segment). Batches memory by character count, not segment count.
function chunkSegments(segments, charsPerChunk = CHARS_PER_CHUNK) {
    const chunks = [];
    let chunk = [], chars = 0;
    for (const segment of segments) {
        if (chunk.length > 0 && chars + segment.text.length > charsPerChunk) {
            chunks.push(chunk);
            chunk = [];
            chars = 0;
        }
        chunk.push(segment);
        chars += segment.text.length;
    }
    if (chunk.length > 0) chunks.push(chunk);
    return chunks;
}

export {
    MODEL_LEN, MAX_INPUT, INPUT_VOCAB, DIACRITIC,
    remove_tashkeel, TASHKEEL_RE, split_windows,
    diacritize, diacritize_batch, chunkSegments, CHARS_PER_CHUNK,
};
