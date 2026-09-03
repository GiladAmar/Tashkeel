# What's new in Tashkeel

## Version 1.0

The first release. Tashkeel adds full diacritics (tashkeel / harakat) to
Arabic text on any web page, entirely on your device.

### Core

- **Diacritize any page**: highlight Arabic text and click the icon to rewrite
  it in place with full tashkeel. Click with nothing selected and the whole
  page is diacritized.
- **Results appear as they are computed.** The page fills in progressively
  instead of freezing until everything is done — a full news homepage finishes
  in a few seconds, with the first results on screen in about a second.
- **Right-click menu**: "Add tashkeel (أضف تشكيل)" on a selection, "Add
  tashkeel to the whole page" anywhere, and "Remove tashkeel (أزل تشكيل)" to
  take it back.
- **Remove / undo**: "Remove tashkeel" undoes exactly what the extension
  added, and nothing else — text that arrived with its own diacritics (a
  Qur'an, a poem, a learning site) is never stripped, and anything you edited
  afterwards is left alone.
- **Keyboard shortcut**: Alt+Shift+N (⌥+Shift+N on Mac), remappable at
  chrome://extensions/shortcuts.
- **Works in text boxes**: select text inside an input field or a comment box
  and it gets tashkeel in place. (Rich editors that keep their own copy of the
  document — Google Docs, and some chat composers — may re-render and drop it;
  use the paste page for those.)
- **Paste page**: right-click the toolbar icon → "Open paste page" for a
  simple paste-and-copy page — useful in apps where the page can't be edited
  directly (Google Docs, Word Online).

### Fast & private

- **Runs entirely on your device (WebAssembly SIMD).** No text ever leaves the
  browser; nothing is sent to a server.
- **Non-Arabic content is skipped entirely.** English text, numbers, links and
  site chrome no longer waste processing time.
- **No first-click delay.** The model warms up in the background when the
  browser starts, so the first use is as fast as every other.
- **Smart re-runs**: running again on the same page only processes text that is
  new since the last run. On sites that keep loading articles as you scroll,
  scroll down and run again — only the new content is processed, and text that
  already has tashkeel is left alone.
- **The extension only runs when you invoke it** (icon, menu, or shortcut) —
  no presence on pages you never use it on, and websites cannot detect that it
  is installed.

### Interface

- **English-first interface**: menu items, buttons and messages are in English
  (with Arabic alongside where it helps) — the extension is for people learning
  Arabic, so the controls shouldn't require reading tashkeel to operate.
