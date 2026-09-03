# Third-party licenses

## Shakkala — Arabic diacritization model

The Arabic tashkeel model shipped in `model/` (`model.json` + weight shards) is
derived from the pretrained **Shakkala** model (`version=3`), converted from its
original Keras format to TensorFlow.js. The input/output dictionaries embedded in
`arabic_dict.mjs` are likewise derived from Shakkala's `input_vocab_to_int` and
`output_int_to_vocab` tables.

- Project: Shakkala — Arabic text vocalization
- Source: https://github.com/Barqawiz/Shakkala
- Copyright (c) 2017 Shakkala Project / Ahmad Barqawi
- License: MIT (covers both the code and the bundled model weights)
- Citation: "Shakkala, Arabic text vocalization, Barqawi & Zerrouki"

The full MIT license text ships next to the model as `model/LICENSE-Shakkala.md`.
See `docs/SHAKKALA_MODEL.md` for the model's I/O contract and conversion provenance.

```
MIT License

Copyright (c) 2017 Shakkala Project (Ahmad Barqawi)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
