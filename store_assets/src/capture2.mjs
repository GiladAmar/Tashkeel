// Close-up element captures: same element before and after tashkeel, high DPR.
import {readFile, writeFile, mkdtemp, cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import puppeteer from 'puppeteer';

const REPO = '/Users/giladamar/PycharmProjects/Nekudot';
const OUT = '/Users/giladamar/PycharmProjects/Nekudot/store_assets/src/raw';

const extDir = await mkdtemp(join(tmpdir(), 'tashkeel-shots2-'));
await cp(join(REPO, 'dist'), extDir, {recursive: true});
const manifest = JSON.parse(await readFile(join(extDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
await writeFile(join(extDir, 'manifest.json'), JSON.stringify(manifest));

const browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`,
           '--lang=ar', '--font-render-hinting=none'],
});
const swTarget = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().includes('background.js'), {timeout: 30000});
const sw = await swTarget.worker();

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const MARKS = '\\u064B-\\u0652';

const armRun = (page) => page.evaluate(() =>
    document.documentElement.removeAttribute('data-tashkeel-busy'));
// Drive the extension's REAL whole-page entrypoint (dots the whole page
// regardless of selection), then screenshot the element of interest.
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
async function waitForStable(page, baseline) {
    let last = baseline, sawBusy = false, idle = 0;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 300));
        const [busy, n] = await Promise.all([
            page.evaluate(() => document.documentElement.hasAttribute('data-tashkeel-busy')).catch(() => false),
            markCount(page).catch(() => last),
        ]);
        last = n;
        if (busy) { sawBusy = true; idle = 0; continue; }
        if (sawBusy || n > baseline) break;
        if (++idle > 240) break;
    }
    return last;
}

async function elemShot(page, selector, path, pad = 8) {
    const el = await page.$(selector);
    const box = await el.boundingBox();
    await page.screenshot({
        path, type: 'png',
        clip: {x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
               width: box.width + pad * 2, height: box.height + pad * 2},
    });
    console.log('saved', path);
}

// Wikipedia: first paragraph close-up, before and after.
const page = await browser.newPage();
await page.setUserAgent(UA);
await page.setViewport({width: 1280, height: 900, deviceScaleFactor: 3});
await page.goto('https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D9%84%D8%BA%D8%A9_%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9',
    {waitUntil: 'networkidle2', timeout: 60000});
// find the first substantial Arabic paragraph and tag it
const P = await page.evaluate(() => {
    for (const p of document.querySelectorAll('p')) {
        const ar = (p.textContent.match(/[ء-ي]/g) || []).length;
        const r = p.getBoundingClientRect();
        if (ar > 100 && r.width > 300) {
            p.id = p.id || 'tashkeel-closeup';
            // give the marks room so clip padding shows them fully
            p.style.padding = '18px 8px';
            return '#' + p.id;
        }
    }
    return null;
});
console.log('wiki paragraph selector:', P);
await elemShot(page, P, join(OUT, 'wiki-ar-p-before.png'));

// whole-page run
const baseP = await markCount(page).catch(() => 0);
await armRun(page);
await invokeOn(page);
const n = await waitForStable(page, baseP);
console.log('marks:', baseP, '->', n);
await page.evaluate(() => window.getSelection().removeAllRanges());
await new Promise(r => setTimeout(r, 300));
await elemShot(page, P, join(OUT, 'wiki-ar-p-after.png'));

// Also: capture selection state (text highlighted) for the "select text" step graphic
await page.close();

// Arabic news main headline close-up before/after.
// (capture3.mjs is the authoritative, padded source for shot1's headline;
//  this is a secondary/fallback capture. Aljazeera is intentionally excluded.)
// NON-POLITICAL sections (culture / science / sports); see capture3.mjs.
const NEWS_SITES = [
    'https://aawsat.com/%D8%AB%D9%82%D8%A7%D9%81%D8%A9-%D9%88%D9%81%D9%86%D9%88%D9%86',   // ثقافة وفنون (culture & arts)
    'https://aawsat.com/%D8%B5%D8%AD%D8%A9-%D9%88%D8%B9%D9%84%D9%88%D9%85',               // صحة وعلوم (health & science)
    'https://aawsat.com/%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9',                       // الرياضة (sports)
    'https://www.bbc.com/arabic/scienceandtech',
    'https://www.skynewsarabia.com/sport',
];
try {
    const p2 = await browser.newPage();
    await p2.setUserAgent(UA);
    await p2.setViewport({width: 1440, height: 900, deviceScaleFactor: 3});
    let sel = null;
    for (const site of NEWS_SITES) {
        try {
            await p2.goto(site, {waitUntil: 'networkidle2', timeout: 90000});
            await new Promise(r => setTimeout(r, 1500));
            // Reject bot-challenge / consent walls that render almost no content.
            const arabic = await p2.evaluate(() =>
                (document.body.innerText.match(/[ء-ي]/g) || []).length);
            console.log(site, 'arabic chars:', arabic);
            if (arabic < 400) { console.log('  too little content, skipping'); continue; }
            // find a clean, text-only headline LINE (no media, capped height)
            sel = await p2.evaluate(() => {
                const cands = [...document.querySelectorAll('h1, h2, h3, a[class*="title" i], [class*="title" i], [class*="headline" i]')];
                let best = null, bestScore = 0;
                for (const el of cands) {
                    if (el.querySelector('img, picture, video, svg, figure, iframe')) continue;
                    const r = el.getBoundingClientRect();
                    const ar = (el.textContent.match(/[ء-ي]/g) || []).length;
                    if (ar < 20 || ar > 160) continue;
                    if (r.width < 320 || r.height < 20 || r.height > 170) continue;
                    if (r.top < 0 || r.top > 900) continue;
                    const score = r.width * ar;
                    if (score > bestScore) { best = el; bestScore = score; }
                }
                if (!best) return null;
                best.id = best.id || 'tashkeel-shot-target';
                best.style.padding = '18px 8px';
                return '#' + best.id;
            });
            console.log(site, 'headline selector:', sel);
            if (sel) break;
        } catch (e) { console.error('news closeup site failed:', site, e.message); }
    }
    if (sel) {
        await elemShot(p2, sel, join(OUT, 'news-before.png'), 14);
        const baseH = await markCount(p2).catch(() => 0);
        await armRun(p2);
        await invokeOn(p2);
        await waitForStable(p2, baseH);
        await p2.evaluate(() => window.getSelection().removeAllRanges());
        await new Promise(r => setTimeout(r, 300));
        await elemShot(p2, sel, join(OUT, 'news-after.png'), 14);
    }
    await p2.close();
} catch (e) { console.error('news closeup failed:', e.message); }

await browser.close();
console.log('done');
