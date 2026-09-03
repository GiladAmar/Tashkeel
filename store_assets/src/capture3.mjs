// Recapture the Arabic news main-headline close-up with generous padding.
import {readFile, writeFile, mkdtemp, cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import puppeteer from 'puppeteer';

const REPO = '/Users/giladamar/PycharmProjects/Nekudot';
const OUT = '/Users/giladamar/PycharmProjects/Nekudot/store_assets/src/raw';

const extDir = await mkdtemp(join(tmpdir(), 'tashkeel-shots3-'));
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
const MARKS = '\\u064B-\\u0652';

// NON-POLITICAL sections (culture / science / sports) of a real Arabic news
// site, so the hero headline carries no politically-charged content or photos
// of political figures. (Al Jazeera excluded; Al Arabiya bot-walls headless.)
const NEWS_SITES = [
    'https://aawsat.com/%D8%AB%D9%82%D8%A7%D9%81%D8%A9-%D9%88%D9%81%D9%86%D9%88%D9%86',   // ثقافة وفنون (culture & arts)
    'https://aawsat.com/%D8%B5%D8%AD%D8%A9-%D9%88%D8%B9%D9%84%D9%88%D9%85',               // صحة وعلوم (health & science)
    'https://aawsat.com/%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9',                       // الرياضة (sports)
    'https://www.bbc.com/arabic/scienceandtech',
    'https://www.skynewsarabia.com/sport',
];

const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');
await page.setViewport({width: 1440, height: 900, deviceScaleFactor: 3});

let sel = null, usedSite = null;
for (const site of NEWS_SITES) {
    try {
        await page.goto(site, {waitUntil: 'networkidle2', timeout: 90000});
        await new Promise(r => setTimeout(r, 1500));
        // Reject bot-challenge / consent walls (e.g. Cloudflare "complete the
        // security check") that render almost no real content.
        const arabic = await page.evaluate(() =>
            (document.body.innerText.match(/[ء-ي]/g) || []).length);
        console.log(site, 'arabic chars:', arabic);
        if (arabic < 400) { console.log('  too little content, skipping'); continue; }
        sel = await page.evaluate(() => {
            // A clean, text-only headline LINE — not the whole article card.
            // Exclude anything wrapping media (photos of real people etc.) and
            // cap the height so we get a headline, not a teaser block.
            const cands = [...document.querySelectorAll('h1, h2, h3, a[class*="title" i], [class*="title" i], [class*="headline" i]')];
            let best = null, bestScore = 0;
            for (const el of cands) {
                if (el.querySelector('img, picture, video, svg, figure, iframe')) continue;
                const r = el.getBoundingClientRect();
                const ar = (el.textContent.match(/[ء-ي]/g) || []).length;
                if (ar < 20 || ar > 160) continue;             // one headline's worth
                if (r.width < 320 || r.height < 20 || r.height > 170) continue;
                if (r.top < 0 || r.top > 900) continue;
                const score = r.width * ar;                     // wide + text-rich
                if (score > bestScore) { best = el; bestScore = score; }
            }
            if (!best) return null;
            best.id = best.id || 'tashkeel-shot-target';
            // give the marks room: extra line-height so clip padding shows them fully
            best.style.padding = '18px 8px';
            return '#' + best.id;
        });
        console.log(site, 'selector:', sel);
        if (sel) { usedSite = site; break; }
    } catch (e) { console.error('news site failed:', site, e.message); }
}
if (!sel) { console.error('no reachable Arabic news site for headline close-up'); await browser.close(); process.exit(1); }
console.log('using news site:', usedSite, 'selector:', sel);

async function elemShot(name) {
    const el = await page.$(sel);
    const box = await el.boundingBox();
    await page.screenshot({path: join(OUT, name), type: 'png',
        clip: {x: Math.max(0, box.x - 4), y: Math.max(0, box.y - 4),
               width: box.width + 8, height: box.height + 8}});
    console.log('saved', name);
}

await elemShot('news-before.png');
const markCount = () => page.evaluate((MARKS) =>
    (document.body.innerText.match(new RegExp(`[${MARKS}]`, 'g')) || []).length, MARKS);
const base = await markCount().catch(() => 0);
// Clear the run marker, then drive the extension's REAL whole-page entrypoint.
await page.evaluate(() => document.documentElement.removeAttribute('data-tashkeel-busy'));
await sw.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const dec = decodeURIComponent(url);
    const tab = tabs.find(t => t.url === url || decodeURIComponent(t.url || '') === dec);
    if (!tab) throw new Error('tab not found: ' + url);
    await globalThis.__tashkeelInvokeWholePage(tab);
}, page.url());
let last = base, sawBusy = false, idle = 0;
const deadline = Date.now() + 180000;
while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 300));
    const [busy, n] = await Promise.all([
        page.evaluate(() => document.documentElement.hasAttribute('data-tashkeel-busy')).catch(() => false),
        markCount().catch(() => last),
    ]);
    last = n;
    if (busy) { sawBusy = true; idle = 0; continue; }
    if (sawBusy || n > base) break;
    if (++idle > 240) break;
}
console.log('marks:', base, '->', last);
await page.evaluate(() => window.getSelection().removeAllRanges());
await new Promise(r => setTimeout(r, 300));
await elemShot('news-after.png');
await browser.close();
console.log('done');
