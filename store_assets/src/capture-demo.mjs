// Record the store demo: a short clip of Tashkeel adding diacritics to a whole
// page in one click, encoded to an MP4 and a looping GIF (both well under 5 MB).
//
// Self-contained and offline by design: it serves a clean, non-political
// Modern-Standard-Arabic article from a local HTTP server (no live site, no
// Cloudflare bot wall, identical every run), loads the built extension with a
// host permission for that origin, pre-warms the model so the click feels
// instant, then drives the extension's REAL whole-page entrypoint
// (__tashkeelInvokeWholePage), exactly like the "Add tashkeel to the whole
// page" menu.
//
// The clip is built from a burst of page.screenshot() frames, NOT puppeteer's
// screencast: the CDP screencast does not repaint Arabic combining marks that
// are injected after the first paint (the recording stays bare even though the
// DOM has the marks), whereas a real screenshot rasterises them correctly —
// the same reason the still store screenshots use page.screenshot().
//
// Prereqs: `npm run build` (dist/) and ffmpeg on PATH. Run from the repo root.
//   node store_assets/src/capture-demo.mjs
// Outputs (gitignored scratch — promote the two you want into store_assets/):
//   store_assets/src/raw/demo.mp4   H.264, for the store's promo video / embeds
//   store_assets/src/raw/demo.gif   looping, for the README / Reddit / social
import {readFile, writeFile, mkdtemp, cp, mkdir, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';

const REPO = '/Users/giladamar/PycharmProjects/Tashkeel';
const OUT = join(REPO, 'store_assets/src/raw');
const FRAMES = join(OUT, 'frames');
await rm(FRAMES, {recursive: true, force: true});
await mkdir(FRAMES, {recursive: true});

const MARKS = '\\u064B-\\u0652'; // Arabic tashkeel U+064B..U+0652
const FPS = 15;                 // capture cadence and playback rate — high
                                // enough that the sub-second fill-in reads as a
                                // top-to-bottom sweep rather than a hard cut

// A neutral MSA article about Arabic and its diacritics — thematically on the
// nose, free of politics/photos, and long enough that the marks visibly stream
// in top-to-bottom rather than appearing all at once. Sized to fit the frame.
const ARTICLE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>العربية والتشكيل</title>
<style>
  html { background: #eef2f8; }
  body {
    margin: 0; padding: 30px 0 34px;
    font-family: "Noto Naskh Arabic", "Amiri", "Geeza Pro", "Segoe UI", serif;
    color: #14213d; line-height: 1.9;
  }
  main {
    max-width: 720px; margin: 0 auto; padding: 30px 42px 34px;
    background: #fff; border-radius: 14px;
    box-shadow: 0 1px 2px rgba(20,33,61,.06), 0 24px 60px -30px rgba(20,33,61,.35);
  }
  .kicker { color: #2563eb; font-weight: 700; font-size: 13px; margin: 0 0 5px; }
  h1 { font-size: 27px; line-height: 1.3; margin: 0 0 15px; color: #0b1533; }
  p { font-size: 17.5px; margin: 0 0 13px; }
  h2 { font-size: 20px; margin: 22px 0 11px; color: #0b1533; }
  .lead { font-size: 19px; color: #334155; }
</style>
</head>
<body>
<main>
  <p class="kicker">لغة · قراءة</p>
  <h1>العربية والتشكيل: كيف تقرأ الكلمة كما يجب أن تنطق</h1>
  <p class="lead">تكتب العربية في الصحف والمواقع والكتب الحديثة دون حركات في أغلب الأحيان، فيقع القارئ الجديد أمام كلمات لا يعرف كيف ينطقها على وجه الدقة.</p>
  <p>الحروف وحدها لا تكفي لتحديد النطق، إذ إن الحركات القصيرة هي التي تميز بين المعاني وتضبط أواخر الكلمات في الجملة، وغيابها يجعل النص محتملا لأكثر من قراءة واحدة.</p>
  <p>يعرف دارسو العربية هذه المشكلة جيدا: كلمة واحدة مجردة من الشكل قد تقرأ على وجوه عدة، ولا يحسم الأمر إلا الحركات التي تدل على الفتح والضم والكسر والسكون فوق الحروف وتحتها.</p>
  <p>ومن هنا كان التشكيل وسيلة أساسية لتعليم القراءة الصحيحة منذ القدم، فهو يرشد اللسان إلى النطق السليم دون الحاجة إلى معرفة الكلمة مسبقا أو تخمين موقعها من الإعراب.</p>
  <h2>لماذا يهم هذا القارئ والمتعلم</h2>
  <p>حين تظهر الحركات على النص تصبح القراءة الجهرية ممكنة بثقة، ويستطيع المتعلم أن يربط الصورة المكتوبة بالصوت المسموع، فيترسخ في ذهنه شكل الكلمة ومعناها معا.</p>
  <p>كثير من الدارسين يقرؤون الأخبار والمقالات يوميا، ويتوقفون عند كل كلمة جديدة حائرين بين أكثر من نطق ممكن، فيضيع الوقت ويفتر الحماس قبل أن تكتمل الفائدة.</p>
  <p>ومع انتشار النصوص الرقمية صار من المفيد أن تتوافر أداة تعيد الحركات إلى أي صفحة يقرأها المتعلم، من الأخبار إلى الموسوعات إلى المقالات الطويلة، بنقرة واحدة.</p>
  <p>تبقى العربية الفصحى الحديثة لغة الصحافة والكتابة الرسمية، وهي التي يجيد فيها هذا النوع من الأدوات وضع التشكيل على نحو دقيق يخدم القارئ ويعينه على الفهم السريع.</p>
</main>
</body>
</html>`;

const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(ARTICLE);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/demo.html`;

const extDir = await mkdtemp(join(tmpdir(), 'tashkeel-demo-'));
await cp(join(REPO, 'dist'), extDir, {recursive: true});
const manifest = JSON.parse(await readFile(join(extDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = [`${origin}/*`];
await writeFile(join(extDir, 'manifest.json'), JSON.stringify(manifest));

const browser = await puppeteer.launch({
    headless: true,
    args: [
        `--disable-extensions-except=${extDir}`,
        `--load-extension=${extDir}`,
        '--lang=ar',
        '--font-render-hinting=none',
        '--force-color-profile=srgb',
    ],
});
const swTarget = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().includes('background.js'),
    {timeout: 30000});
const sw = await swTarget.worker();

const page = await browser.newPage();
await page.setViewport({width: 900, height: 1000, deviceScaleFactor: 2});
await page.goto(url, {waitUntil: 'networkidle0', timeout: 30000});

const markCount = () => page.evaluate((M) =>
    (document.body.innerText.match(new RegExp(`[${M}]`, 'g')) || []).length, MARKS);
const isBusy = () => page.evaluate(() =>
    document.documentElement.hasAttribute('data-tashkeel-busy')).catch(() => false);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Pre-warm the model so the click produces marks immediately (no cold-start
// pause on screen).
await sw.evaluate(() => globalThis.__tashkeelEnsureModel());
const base = await markCount();
await page.evaluate(() => document.documentElement.removeAttribute('data-tashkeel-busy'));

// Capture a frame roughly every 1/FPS seconds, padding out the wall-clock so
// playback runs at real speed.
let frame = 0;
const period = 1000 / FPS;
async function grab() {
    const t = Date.now();
    await page.screenshot({path: join(FRAMES, `f${String(frame++).padStart(4, '0')}.png`), type: 'png'});
    const rest = period - (Date.now() - t);
    if (rest > 0) await wait(rest);
}

// 1. "Before": the page as you'd normally read it.
for (let i = 0; i < 16; i++) await grab();

// 2. The one click — invoke returns once the content script is injected, well
//    before diacritization finishes, so the fill-in is captured live.
await sw.evaluate(async (u) => {
    const [tab] = await chrome.tabs.query({url: u});
    if (!tab) throw new Error('tab not found: ' + u);
    await globalThis.__tashkeelInvokeWholePage(tab);
}, url);

// 3. Stream: keep grabbing while the marks fill in.
const deadline = Date.now() + 30000;
let sawBusy = false;
while (Date.now() < deadline) {
    await grab();
    const [busy, n] = await Promise.all([isBusy(), markCount()]);
    if (busy) sawBusy = true;
    if (!busy && (sawBusy || n > base) && frame > 20) break;
}
const total = await markCount();

// 4. "After": hold on the fully vocalised page.
for (let i = 0; i < 30; i++) await grab();

console.log(`marks: ${base} -> ${total}, frames: ${frame}`);
await page.close();
await browser.close();
server.close();

// --- encode: MP4 (H.264) + looping GIF from the frame sequence --------------
function run(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, {stdio: ['ignore', 'ignore', 'inherit']});
        p.on('error', reject);
        p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
    });
}

const input = join(FRAMES, 'f%04d.png');
const mp4 = join(OUT, 'demo.mp4');
const gif = join(OUT, 'demo.gif');
const palette = join(OUT, 'demo-palette.png');

await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', input,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);

await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', input,
    '-vf', 'scale=820:-1:flags=lanczos,palettegen=stats_mode=diff', palette]);
await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', input, '-i', palette,
    '-lavfi', 'scale=820:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
    '-loop', '0', gif]);

console.log('wrote', mp4, gif);
