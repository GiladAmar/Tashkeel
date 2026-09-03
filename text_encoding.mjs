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

// Segments are grouped into chunks of about this many characters, and each
// chunk is diacritized and streamed to the page before the next starts. Since
// diacritize_batch now packs short segments, a chunk this size is only a
// handful of model rows, so keeping it small makes the first words appear in
// well under a second and lets results flow onto the page in many small
// updates rather than a few big jumps — at a negligible cost to total time.
const CHARS_PER_CHUNK = 1500;

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

// Run one batch of rows (each an array of code points, at most MAX_INPUT long)
// through the model and return the per-position diacritic class ids, flat:
// the class for row b position i is at clsData[b * MODEL_LEN + i]. Rows are
// right-padded with the pad id (0) to MODEL_LEN.
async function predict_class_rows(tf, model, rowChars) {
    const batch = rowChars.length;
    const data = new Float32Array(batch * MODEL_LEN); // zero == <PAD>
    for (let b = 0; b < batch; b++) {
        const chars = rowChars[b];
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
    return clsData;
}

// Rebuild the diacritized string for chars[from .. from+len) using the class
// ids at those same row positions (base = b * MODEL_LEN). Only Arabic letters
// take a mark; everything else — spaces, punctuation, the packing separators —
// is emitted verbatim, so a piece round-trips to exactly its input.
function reconstruct(chars, clsData, base, from, len) {
    let out = '';
    for (let k = 0; k < len; k++) {
        const ch = chars[from + k];
        out += ARABIC_LETTER_RE.test(ch)
            ? ch + DIACRITIC[clsData[base + from + k]]
            : ch;
    }
    return out;
}

// A single space between packed pieces: natural word-boundary context for the
// model, and never counted into any piece's own character range.
const PACK_SEP = ' ';

// Diacritize an array of segment texts, returning an array of results aligned
// to the input. Existing tashkeel is stripped first and each segment is
// windowed; short pieces are then PACKED several-to-a-row (up to MAX_INPUT
// characters, space-separated) before the model runs, so a page of hundreds of
// tiny segments doesn't spend one padded 315-wide row per segment. The per-char
// output is split back onto each piece by exact offset, then stitched per text.
async function diacritize_batch(tf, model, texts) {
    // 1. Bare each text and window it, keeping pieces in reading order with
    //    their owning text index.
    const pieces = [];
    texts.forEach((text, ti) => {
        for (const w of split_windows(remove_tashkeel(text)))
            pieces.push({owner: ti, chars: Array.from(w)});
    });

    // 2. Pack pieces into rows of up to MAX_INPUT characters. Each row records
    //    where every piece sits (from, len) so its output can be recovered.
    const rows = [];       // char arrays, one per model row
    const rowItems = [];   // parallel: [{owner, from, len}, ...] per row
    let chars = [], items = [];
    const flush = () => {
        if (chars.length) { rows.push(chars); rowItems.push(items); chars = []; items = []; }
    };
    for (const p of pieces) {
        const sep = chars.length ? 1 : 0;
        if (chars.length && chars.length + sep + p.chars.length > MAX_INPUT) flush();
        if (chars.length) chars.push(PACK_SEP);
        const from = chars.length;
        for (const c of p.chars) chars.push(c);
        items.push({owner: p.owner, from, len: p.chars.length});
    }
    flush();

    // 3. Predict row-batches and stitch each piece back onto its text.
    const perText = texts.map(() => []);
    for (let i = 0; i < rows.length; i += ROWS_PER_PREDICT) {
        const slice = rows.slice(i, i + ROWS_PER_PREDICT);
        const clsData = await predict_class_rows(tf, model, slice);
        for (let b = 0; b < slice.length; b++) {
            const base = b * MODEL_LEN;
            for (const it of rowItems[i + b])
                perText[it.owner].push(reconstruct(slice[b], clsData, base, it.from, it.len));
        }
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
