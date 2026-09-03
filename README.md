# Tashkeel

A Chrome extension that adds Arabic diacritics (tashkeel / harakat) to text on
any web page, in one click. Highlight Arabic text and click the icon — or click
with nothing selected to vocalise the whole page. Everything runs on your device
with TensorFlow.js (WebAssembly); no server, no account, works offline.

This is the Arabic sibling of Nekudot (Hebrew niqqud). It shares the same
in-browser pipeline — selection/whole-page/editable-field/paste-page modes,
incremental re-runs, one-click undo — with the language core swapped for Arabic.

## The model

Diacritization uses **Shakkala** by Ahmad Barqawi
(https://github.com/Barqawiz/Shakkala), a character-level BiLSTM for Arabic text
vocalization, used under the MIT license and converted from Keras to TensorFlow.js
so it runs entirely in the browser. See `docs/SHAKKALA_MODEL.md` for the model's
I/O contract and conversion provenance, and `THIRD_PARTY_LICENSES.md` /
`model/LICENSE-Shakkala.md` for licensing.

## Local setup

Install the requirements:

`npm i`

Build the extension:

`npm run build`

Then load the `dist/` folder as an unpacked extension:
https://webkul.com/blog/how-to-install-the-unpacked-extension-in-chrome/

## Tests

- `npm test` — unit tests (encoding, the real model, quantizer, manifest, jsdom real-page pipeline).
- `npm run fixtures` — download live Arabic news homepages as optional real-page fixtures.
- `npm run test:e2e` — end-to-end tests in headless Chrome with the built extension.
