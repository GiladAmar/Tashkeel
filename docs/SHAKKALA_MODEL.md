# Shakkala → TensorFlow.js — I/O Contract

Arabic diacritization (tashkeel) model converted from the pretrained **Shakkala**
Keras model (`version=3`, `second_model6.h5`) to a **TensorFlow.js layers model**.

Source: https://github.com/Barqawiz/Shakkala — model + dictionaries under
`shakkala/model/` and `shakkala/dictionary/`.

---

## 1. tfjs model location & facts

- **Path:** `arabic_model_build/tfjs_model/`
  - `model.json`  (8,656 bytes)
  - `group1-shard1of3.bin`, `group1-shard2of3.bin`, `group1-shard3of3.bin`
- **`model.json` `"format"`:** `layers-model`  ✅ (loadable with `tf.loadLayersModel`)
- **generatedBy:** keras v2.19.0 — **convertedBy:** TensorFlow.js Converter v4.17.0
- **Total weight bytes (3 shards):** **10,025,200 bytes** (~9.56 MB)
- **Total params:** 2,506,300 (trainable 2,505,148 / non-trainable 1,152)

### Topology (Keras `Sequential`)
| # | Layer | Output shape | Notes |
|---|-------|--------------|-------|
| 0 | InputLayer | (None, 315) | int token ids |
| 1 | Embedding `embedding_7` | (None, 315, 288) | **input_dim = 149**, **output_dim = 288** |
| 2 | Bidirectional LSTM | (None, 315, 576) | |
| 3 | BatchNormalization | (None, 315, 576) | |
| 4 | Bidirectional LSTM | (None, 315, 288) | |
| 5 | Bidirectional LSTM | (None, 315, 192) | |
| 6 | Dense `dense_7` (softmax) | (None, 315, 28) | **28 output classes** |

- **Input tensor:** shape `[batch, 315]`, dtype float32 (integer token ids as floats).
- **Output tensor:** shape `[batch, 315, 28]` — per-position softmax over 28 classes.
- Note: embedding `input_dim` is 149, but only indices **0..120** are ever produced
  by the vocab (padding index is 0). Any index in `[0,148]` is a valid embedding row.

### Numerical verification
Loaded the converted model in Node (`@tensorflow/tfjs-layers` 4.22.0, cpu backend)
and compared `argmax` over all 315 positions against the original tf-keras model on
the sample sentence: **0 / 315 mismatches**. See `verify.mjs`.

---

## 2. Input vocabulary (char → int)

- **Full map dumped to:** `arabic_model_build/input_vocab.json` (120 entries, indices 0–120).
- Lookup is per **Unicode character**; unknown chars map to `<UNK>` (id 1).
- The vocabulary is a fixed frozen dict from the pickle
  `shakkala/dictionary/input_vocab_to_int.pickle`.

### Structural / special tokens
| token | id | note |
|-------|----|------|
| `<PAD>` | 0 | padding (post) |
| `<UNK>` | 1 | any char not in vocab |
| `<GO>`  | 2 | (unused at inference) |
| `<EOS>` | 3 | (unused at inference) |
| space ` ` (U+0020) | 28 | |

### Core Arabic letters (subset — full list in input_vocab.json)
```
ء U+0621=120  آ U+0622=15  أ U+0623=73  ؤ U+0624=50  إ U+0625=119  ئ U+0626=56
ا U+0627=68   ب U+0628=118  ة U+0629=107  ت U+062A=22  ث U+062B=71  ج U+062C=59
ح U+062D=86   خ U+062E=19   د U+062F=104  ذ U+0630=97  ر U+0631=65  ز U+0632=92
س U+0633=82   ش U+0634=18   ص U+0635=75   ض U+0636=111 ط U+0637=93  ظ U+0638=11
ع U+0639=95   غ U+063A=24   ف U+0641=46   ق U+0642=38  ك U+0643=72  ل U+0644=29
م U+0645=48   ن U+0646=81   ه U+0647=49   و U+0648=6   ى U+0649=39  ي U+064A=70
ٱ U+0671=67   ٰ U+0670=45   ـ U+0640=9 (tatweel)
```
The vocab also contains many "extras": Arabic-presentation-form ligatures
(U+FBxx/U+FExx/U+FEFx e.g. `ﻻ`=79, `ﺇ`=57), Greek letters, Latin punctuation/quotes,
Persian/Urdu digits (`۵ ۷ ۸`), bidi/zero-width controls (U+200B..U+202C), `°`, `%`
(`٪`=91), `…`, `–`, `«»`, etc. Any character outside this map → `<UNK>` (1).

---

## 3. Output classes (int → diacritic)

- **Full map dumped to:** `arabic_model_build/output_classes.json` (28 entries).
- From `shakkala/dictionary/output_int_to_vocab.pickle`. Each class is the diacritic
  string to place **after** the corresponding input character.

| idx | string | Unicode code points | meaning |
|-----|--------|---------------------|---------|
| 0 | `<PAD>` | — | pad (skip) |
| 1 | `<UNK>` | — | unknown → **rendered as no diacritic** |
| 2 | `<GO>`  | — | (unused) |
| 3 | `<EOS>` | — | (unused) |
| 4 | `ـ` | U+0640 | **NO DIACRITIC** (tatweel placeholder → blanked) |
| 5 | `َ` | U+064E | fatha |
| 6 | `ُّ` | U+064F U+0651 | damma + shadda |
| 7 | `َّ` | U+064E U+0651 | fatha + shadda |
| 8 | `ـ` | U+0640 | **NO DIACRITIC** (duplicate of 4) |
| 9 | `ِّ` | U+0651 U+0650 | shadda + kasra |
| 10 | `ّ` | U+0651 | shadda |
| 11 | `ّْ` | U+0652 U+0651 | sukun + shadda |
| 12 | `ٍّ` | U+0651 U+064D | shadda + kasratan |
| 13 | `ِّ` | U+0650 U+0651 | kasra + shadda |
| 14 | `ٍّ` | U+064D U+0651 | kasratan + shadda |
| 15 | `ٌّ` | U+064C U+0651 | dammatan + shadda |
| 16 | `َّ` | U+0651 U+064E | shadda + fatha |
| 17 | `ُ` | U+064F | damma |
| 18 | `ٌّ` | U+0651 U+064C | shadda + dammatan |
| 19 | `ًّ` | U+0651 U+064B | shadda + fathatan |
| 20 | `ْ` | U+0652 | sukun |
| 21 | `ٍ` | U+064D | kasratan |
| 22 | `ِ` | U+0650 | kasra |
| 23 | `ُّ` | U+0651 U+064F | shadda + damma |
| 24 | `ًّ` | U+064B U+0651 | fathatan + shadda |
| 25 | `ٌ` | U+064C | dammatan |
| 26 | `ً` | U+064B | fathatan |
| 27 | `ّّ` | U+0651 U+0651 | shadda + shadda (rare/degenerate) |

**"No diacritic" classes:** indices **4** and **8** (both U+0640 tatweel), plus
`<UNK>` (1) — all three are emitted as an **empty** string during reconstruction.

**Shadda combinations:** shadda (U+0651) pairs appear in BOTH orders because the
training labels preserved raw ordering (e.g. 6 vs 23 are both damma+shadda, 7 vs 16
both fatha+shadda, 13 vs 9 both kasra+shadda, 12/14, 15/18, 19/24). Downstream code
should treat them by their literal string value — do not assume a canonical order.

---

## 4. MAX_LENGTH / padding / tokens

- **MAX_LENGTH (`max_sentence`) = 315** for `version=3` (and `version=2`).
  (`version=1` simple_model uses 495.) Input must be **shorter than** 315 chars
  (`len(input) < 315`); longer text must be split into multiple calls.
- **Padding:** Keras `pad_sequences(..., maxlen=315, padding='post')` — right-pad
  with id **0** (`<PAD>`) up to length 315. No truncation needed if under the limit.
- **No start/end token is prepended at inference.** `<GO>`/`<EOS>` exist in the
  vocab but the Shakkala inference path does not use them. Text is fed char-by-char.
- One sentence per prediction; batch dim added as `[[...ids...]]`.

---

## 5. Reconstruction algorithm (per-char class → diacritized string)

Exactly as Shakkala does it (`Shakkala.logits_to_text` +
`helper.combine_text_with_harakat`):

```
INPUT:  original_text (string, length L, L < 315)
        logits (array [315][28] of softmax probs)

# 1. per-position argmax → class string, dropping <PAD> positions
harakat = []
for t in 0..314:
    cls = argmax(logits[t])            # 0..27
    s   = OUTPUT_CLASSES[cls]           # string
    if s == '<PAD>':                    # (padded tail) -> skip entirely
        continue
    harakat.append(s)

# 2. length-align: pad harakat with "" until it matches len(original_text)
while len(harakat) < L:
    harakat.append("")
# (harakat is effectively truncated by the zip below if longer)

# 3. zip characters with predicted diacritics
result = ""
for (ch, h) in zip(original_text, harakat):
    if h == '<UNK>' or h == 'ـ':        # tatweel (idx 4/8) and <UNK> -> no diacritic
        h = ''
    result += ch + h
return result
```

Notes / gotchas for a faithful port:
- The `<PAD>`-skip in step 1 shifts the list; the model only predicts `<PAD>` on the
  right-padded tail, so after truncating input to real length the first `L` predictions
  align 1:1 with `original_text[0..L-1]`. Simplest correct port: **take predictions for
  positions 0..L-1 only** (ignore padded tail) and map each to its class string,
  blanking classes 1 (`<UNK>`), 4 and 8 (`ـ`).
- The diacritic string is appended AFTER the character (Arabic combining marks).
- `<GO>`/`<EOS>` never appear in valid outputs.

---

## 6. Character pass-through behaviour

- Shakkala does **NOT** filter or strip anything from the input at inference — every
  input character is kept and emitted verbatim, with a predicted diacritic appended.
- Non-Arabic characters (spaces, punctuation, Latin, digits) are still fed to the
  model. Space (U+0020) is a real vocab id (28); most others hit `<UNK>` (1). The model
  almost always predicts the "no diacritic" class (4/8) for such positions, so they
  **pass through unchanged**. There is no hard rule guaranteeing this — it is learned
  behaviour, so occasionally a stray haraka on punctuation is possible.
- Characters not in the input vocab still occupy a position and get a predicted
  diacritic; they are preserved (the original char is re-emitted, only the diacritic
  is machine-chosen).
- Helper utilities exist for pre-cleaning (not applied automatically):
  `clear_tashkel` (strip existing harakat U+064B–U+0652,U+0670? actually the 8 in
  `harakat=[1614,1615,1616,1618,1617,1611,1612,1613]`), `clear_punctuations`,
  `clear_english_and_numbers`. `harakat` set used for stripping = U+064E,U+064F,U+0650,
  U+0652,U+0651,U+064B,U+064C,U+064D.

---

## 7. License

- **Shakkala code:** MIT License (Copyright (c) 2017 Shakkala Project /
  Ahmad Barqawi). See `Shakkala/LICENSE.md`. The pretrained model weights ship in the
  same MIT-licensed repo/PyPI package with no separate/more-restrictive license — MIT
  therefore covers the weights as distributed.
- **Citation:** "Shakkala, Arabic text vocalization, Barqawi & Zerrouki".

---

## 8. Build provenance (for reproducibility)

- venv: `arabic_model_build/.venv` (Python 3.12.10).
- Original load / inference: `tensorflow==2.19.0` + `tf-keras==2.19.0`
  (`TF_USE_LEGACY_KERAS=1`), loading `second_model6.h5`.
- Conversion: `tensorflowjs==4.17.0` via `tfjs.converters.save_keras_model`.
  - tensorflowjs 3.18 (first resolved) was incompatible with a py3.12 TF; upgrading to
    4.17.0 pulled TF 2.19 + numpy 2.1. tfjs 4.17 hard-imports `tensorflow_decision_forests`
    (protobuf-version-incompatible) — stubbed it out in `convert.py`
    (`sys.modules['tensorflow_decision_forests'] = ModuleType(...)`), and installed
    `setuptools<81` for `pkg_resources`. Conversion then succeeded cleanly.
- Sample I/O in `sanity.txt`; scripts: `dump_dicts.py`, `infer.py`, `convert.py`,
  `refgen.py`, `verify.mjs`.
