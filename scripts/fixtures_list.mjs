// Test fixtures — real pages run through the extension's exact pipeline.
// Shared by scripts/fetch_fixture.mjs, tests/real_page.test.mjs and
// e2e/extension.test.mjs, so adding one here reaches every test layer.
//
// regression-page.html is COMMITTED: an authored page reproducing every
// construct that has actually broken this extension (nbsp-glued words, a
// token longer than a model row, an over-long word, pre-vocalised text,
// hidden subtrees, form controls, Arabic inside script payloads). Tests and
// CI depend only on it, so runs are deterministic and need no network.
//
// The live news homepages are OPTIONAL and gitignored — third-party
// content that changes daily. `npm run fixtures` downloads them to check
// against today's real markup; every test skips them when absent. The set
// is Modern Standard Arabic news whose article/teaser text is unvocalised,
// which is exactly the input a tashkeel model must handle.
export const FIXTURES = [
    {name: 'regression-page.html'},
    {name: 'aljazeera-home.html', url: 'https://www.aljazeera.net/'},
    {name: 'alarabiya-home.html', url: 'https://www.alarabiya.net/'},
    {name: 'aawsat-home.html', url: 'https://aawsat.com/'},
    {name: 'bbcarabic-home.html', url: 'https://www.bbc.com/arabic'},
    {name: 'skynewsarabia-home.html', url: 'https://www.skynewsarabia.com/'},
];
