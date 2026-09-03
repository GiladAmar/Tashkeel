// Capture real before/after screenshots of the Tashkeel extension running on
// live webpages. Run from the repo root so puppeteer resolves.
import {readFile, writeFile, mkdtemp, cp, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import puppeteer from 'puppeteer';

const REPO = '/Users/giladamar/PycharmProjects/Nekudot';
const OUT = '/Users/giladamar/PycharmProjects/Nekudot/store_assets/src/raw';
await mkdir(OUT, {recursive: true});

// Arabic tashkeel (diacritics): U+064B..U+0652 — matches TASHKEEL_RE in
// text_encoding.mjs. Deliberately excludes U+0670 (superscript alef).
const MARKS = '\\u064B-\\u0652';

// --- extension copy with host permissions so automation can inject ---------
const extDir = await mkdtemp(join(tmpdir(), 'tashkeel-shots-'));
await cp(join(REPO, 'dist'), extDir, {recursive: true});
const manifest = JSON.parse(await readFile(join(extDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
await writeFile(join(extDir, 'manifest.json'), JSON.stringify(manifest));

const browser = await puppeteer.launch({
    headless: true,
    args: [
        `--disable-extensions-except=${extDir}`,
        `--load-extension=${extDir}`,
        '--lang=ar',
        '--font-render-hinting=none',
    ],
});
const swTarget = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().includes('background.js'),
    {timeout: 30000});
const sw = await swTarget.worker();
const extId = new URL(swTarget.url()).host;
console.log('extension id:', extId);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

async function newPage(w = 1280, h = 800, dpr = 2) {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({width: w, height: h, deviceScaleFactor: dpr});
    return page;
}

const selectAll = (page) => page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.body);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
});

const clearSelection = (page) => page.evaluate(() => window.getSelection().removeAllRanges());

// Clear the run marker so a previous run can't be mistaken for this one.
const armRun = (page) => page.evaluate(() =>
    document.documentElement.removeAttribute('data-tashkeel-busy'));

// Drive the extension's REAL whole-page entrypoint (frame probe + narrowing
// included) exactly like the "Add tashkeel to the whole page" menu item —
// far more reliable than a bare chrome.scripting.executeScript, and it dots
// the whole page regardless of any selection. Arabic URLs are percent-encoded,
// so match the tab by either the raw or decoded URL.
const invokeOn = async (page) => {
    await sw.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const dec = decodeURIComponent(url);
        const tab = tabs.find(t => t.url === url || decodeURIComponent(t.url || '') === dec);
        if (!tab) throw new Error('tab not found: ' + url);
        await globalThis.__tashkeelInvokeWholePage(tab);
    }, page.url());
};

const markCount = (page) => page.evaluate((MARKS) =>
    (document.body.innerText.match(new RegExp(`[${MARKS}]`, 'g')) || []).length, MARKS);

// Wait on the content script's own busy flag (data-tashkeel-busy) rather than
// guessing from when marks stop changing (a slow chunk looks like completion).
async function waitForStable(page, baseline, timeoutMs = 180000) {
    let last = baseline, sawBusy = false, idle = 0;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 300));
        const [busy, n] = await Promise.all([
            page.evaluate(() => document.documentElement.hasAttribute('data-tashkeel-busy')).catch(() => false),
            markCount(page).catch(() => last),
        ]);
        last = n;
        if (busy) { sawBusy = true; idle = 0; continue; }
        if (sawBusy || n > baseline) break;
        if (++idle > 240) break; // ~72s cold-start grace
    }
    return last;
}

// remove floating junk that would spoil a screenshot
const cleanPage = (page) => page.evaluate(() => {
    const kill = [
        '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]',
        '[class*="consent" i]', '[id*="popup" i]', '[class*="sticky-ad" i]',
        '[id*="taboola" i]', '[class*="taboola" i]', 'iframe[src*="ads"]',
        '[aria-label*="advert" i]',
    ];
    for (const sel of kill) document.querySelectorAll(sel).forEach(el => el.remove());
    // freeze animations for identical before/after framing
    const style = document.createElement('style');
    style.textContent = '*{animation:none!important;transition:none!important}';
    document.head.appendChild(style);
});

async function shoot(page, name) {
    await page.screenshot({path: join(OUT, name), type: 'png'});
    console.log('saved', name);
}

// ---------------------------------------------------------------------------
// 1. Arabic Wikipedia article (اللغة العربية) — clean typography, great before/after
// ---------------------------------------------------------------------------
try {
    const page = await newPage();
    // /wiki/اللغة_العربية — the article about the Arabic language itself.
    await page.goto('https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%84%D8%BA%D8%A9_%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9',
        {waitUntil: 'networkidle2', timeout: 60000});
    await cleanPage(page);
    // hide wikipedia banners
    await page.evaluate(() => {
        document.querySelectorAll('.mw-banner-container, #siteNotice, .vector-header-container .mw-ui-button').forEach(e => e.remove());
    });
    await new Promise(r => setTimeout(r, 1000));
    await shoot(page, 'wiki-ar-before.png');
    const base = await markCount(page).catch(() => 0);
    await armRun(page);
    await invokeOn(page);
    const n = await waitForStable(page, base);
    console.log('wiki marks:', base, '->', n);
    await clearSelection(page);
    await new Promise(r => setTimeout(r, 300));
    await shoot(page, 'wiki-ar-after.png');
    await page.close();
} catch (e) { console.error('wiki failed:', e.message); }

// ---------------------------------------------------------------------------
// 2. Arabic news — a NON-POLITICAL section of a real news site, so the store
//    imagery carries no politically-charged headlines and no photos of
//    political figures. This full-page shot (shot3 background) uses the
//    SCIENCE/HEALTH section, which is the most reliably free of political
//    figures even in text; the shot1 headline (capture3.mjs) uses culture.
//    (Al Jazeera excluded by editorial decision; Al Arabiya bot-walls headless.)
// ---------------------------------------------------------------------------
const NEWS_SITES = [
    'https://aawsat.com/%D8%B5%D8%AD%D8%A9-%D9%88%D8%B9%D9%84%D9%88%D9%85',               // صحة وعلوم (health & science)
    'https://aawsat.com/%D8%B9%D9%84%D9%88%D9%85',                                        // علوم (science)
    'https://aawsat.com/%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9',                       // الرياضة (sports)
    'https://www.bbc.com/arabic/scienceandtech',
    'https://www.skynewsarabia.com/sport',
];
try {
    const page = await newPage();
    let loaded = null;
    for (const site of NEWS_SITES) {
        try {
            await page.goto(site, {waitUntil: 'networkidle2', timeout: 90000});
            await new Promise(r => setTimeout(r, 2000));
            // require a decent amount of undiacritized Arabic on screen
            const arabic = await page.evaluate(() =>
                (document.body.innerText.match(/[ء-ي]/g) || []).length);
            console.log(site, 'arabic chars:', arabic);
            if (arabic > 400) { loaded = site; break; }
        } catch (e) { console.error('news site failed:', site, e.message); }
    }
    if (!loaded) throw new Error('no reachable Arabic news site');
    console.log('using news site:', loaded);
    await cleanPage(page);
    await new Promise(r => setTimeout(r, 1500));
    await shoot(page, 'news-full-before.png');
    const base = await markCount(page).catch(() => 0);
    await armRun(page);
    await invokeOn(page);
    const n = await waitForStable(page, base);
    console.log('news marks:', base, '->', n);
    await clearSelection(page);
    await new Promise(r => setTimeout(r, 300));
    await shoot(page, 'news-full-after.png');
    await page.close();
} catch (e) { console.error('news failed:', e.message); }

// ---------------------------------------------------------------------------
// 3. Paste page — before and after
// ---------------------------------------------------------------------------
try {
    const page = await newPage(1100, 720, 2);
    await page.goto(`chrome-extension://${extId}/paste.html`, {waitUntil: 'load'});
    await page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'light'}]);
    const sample = 'جلس القط الصغير عند النافذة ينظر إلى المطر. كان يحلم بيوم مشمس جديد، وبعصافير في السماء، وبحليب دافئ في الصحن.';
    await page.evaluate((t) => {
        const input = document.getElementById('input');
        input.value = t;
        input.dispatchEvent(new Event('input', {bubbles: true}));
    }, sample);
    await shoot(page, 'paste-before.png');
    await page.click('#run');
    await page.waitForFunction(() => {
        const out = document.getElementById('output');
        return out && /[ً-ْ]/.test(out.value);
    }, {timeout: 120000});
    await new Promise(r => setTimeout(r, 3000)); // let it finish fully
    await shoot(page, 'paste-after.png');
    await page.close();
} catch (e) { console.error('paste failed:', e.message); }

await browser.close();
console.log('done');
