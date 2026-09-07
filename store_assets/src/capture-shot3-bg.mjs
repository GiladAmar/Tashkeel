// Regenerate the dotted background used behind the callout cards in shot3
// (store_assets/src/raw/news-full-after.png).
//
// The original background was a LIVE Arabic news homepage captured by
// capture.mjs; that path bot-walls headless Chrome and dates the imagery to the
// day's (possibly political) headlines. This produces an equivalent background
// fully offline and deterministically: it serves a neutral, non-political
// Arabic news page (science/health register) from a local server, dots it with
// the real extension exactly like capture.mjs does, and full-page screenshots
// the result. It's only ever seen dimmed behind the cards, so the layout just
// needs to read as "a real web page, now with tashkeel".
//
// Prereqs: `npm run build`. Run from the repo root:
//   node store_assets/src/capture-shot3-bg.mjs
import {readFile, writeFile, mkdtemp, cp, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import puppeteer from 'puppeteer';

const REPO = '/Users/giladamar/PycharmProjects/Tashkeel';
const OUT = join(REPO, 'store_assets/src/raw');
await mkdir(OUT, {recursive: true});
const MARKS = '\\u064B-\\u0652';

const PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>علوم وصحة</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Noto Naskh Arabic", "Amiri", "Geeza Pro", "Segoe UI", sans-serif; color: #1e293b; background: #fff; }
  .topbar { height: 52px; background: #0b1533; color: #fff; display: flex; align-items: center; gap: 26px; padding: 0 40px; font-size: 16px; }
  .topbar .brand { font-weight: 800; font-size: 22px; color: #fff; }
  .topbar a { color: #c7d2e6; text-decoration: none; }
  .strip { height: 34px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 22px; padding: 0 40px; font-size: 14px; color: #475569; }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 26px 40px 40px; display: grid; grid-template-columns: 1fr 300px; gap: 40px; }
  .kicker { color: #b45309; font-weight: 800; font-size: 15px; margin: 0 0 8px; }
  h1 { font-size: 36px; line-height: 1.3; margin: 0 0 14px; color: #0b1533; }
  .byline { color: #64748b; font-size: 14px; margin: 0 0 20px; }
  article p { font-size: 19px; line-height: 2; margin: 0 0 16px; }
  aside h2 { font-size: 17px; color: #0b1533; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin: 4px 0 14px; }
  aside li { font-size: 16.5px; line-height: 1.7; margin-bottom: 14px; color: #334155; list-style: none; padding-inline-start: 0; border-bottom: 1px solid #eef2f7; padding-bottom: 12px; }
  aside ul { padding: 0; margin: 0; }
</style>
</head>
<body>
  <div class="topbar"><span class="brand">الشرق</span><a>الرئيسية</a><a>سياسة</a><a>اقتصاد</a><a>علوم</a><a>رياضة</a><a>ثقافة</a></div>
  <div class="strip"><span>علوم وصحة</span><span>·</span><span>أحدث الأخبار</span><span>·</span><span>الأكثر قراءة</span></div>
  <div class="wrap">
    <article>
      <p class="kicker">علوم وصحة</p>
      <h1>دراسة حديثة: النوم المنتظم يحسن الذاكرة والقدرة على التركيز خلال النهار</h1>
      <p class="byline">فريق التحرير · قبل ساعتين</p>
      <p>أظهرت دراسة علمية جديدة أن الحصول على قسط منتظم من النوم كل ليلة يسهم في تحسين الذاكرة ويعزز قدرة الدماغ على التركيز وأداء المهام اليومية بكفاءة أعلى.</p>
      <p>وأوضح الباحثون أن انتظام مواعيد النوم والاستيقاظ أهم من عدد الساعات وحده، إذ يساعد الجسم على ضبط ساعته البيولوجية وتنظيم إفراز الهرمونات المرتبطة باليقظة والراحة.</p>
      <p>وشملت الدراسة عددا كبيرا من المشاركين على مدى عدة أشهر، وقارن الفريق بين أنماط نومهم ونتائج اختبارات الانتباه والذاكرة التي أجريت في أوقات مختلفة من النهار.</p>
      <p>وأشار المختصون إلى أن تقليل التعرض للشاشات قبل النوم بساعة على الأقل، والحفاظ على غرفة هادئة ومعتمة، من أبسط الخطوات التي تحسن جودة النوم لدى معظم الناس.</p>
      <p>وأضاف الباحثون أن النشاط البدني المعتدل خلال النهار يرتبط بنوم أعمق ليلا، وأن الوجبات الثقيلة في وقت متأخر قد تؤخر النوم وتقلل من فائدته.</p>
      <p>ويؤكد الخبراء أن هذه النتائج تفتح المجال أمام برامج بسيطة لتحسين الصحة العامة تعتمد على تعديل العادات اليومية أكثر من اعتمادها على الأدوية أو المكملات.</p>
    </article>
    <aside>
      <h2>الأكثر قراءة</h2>
      <ul>
        <li>باحثون يطورون طريقة جديدة لتحلية مياه البحر بطاقة أقل</li>
        <li>اكتشاف نوع نادر من الفراشات في مرتفعات جبلية معزولة</li>
        <li>تطبيق يساعد على تعلم القراءة يحقق انتشارا واسعا بين الطلاب</li>
        <li>دراسة: المشي اليومي يقلل خطر الإصابة بأمراض القلب</li>
        <li>علماء يرصدون إشارات جديدة من مجرة بعيدة</li>
      </ul>
    </aside>
  </div>
</body>
</html>`;

const server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(PAGE); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/news.html`;

const extDir = await mkdtemp(join(tmpdir(), 'tashkeel-shot3-'));
await cp(join(REPO, 'dist'), extDir, {recursive: true});
const manifest = JSON.parse(await readFile(join(extDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = [`${origin}/*`];
await writeFile(join(extDir, 'manifest.json'), JSON.stringify(manifest));

const browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, '--lang=ar', '--font-render-hinting=none'],
});
const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes('background.js'), {timeout: 30000});
const sw = await swTarget.worker();

const page = await browser.newPage();
await page.setViewport({width: 1060, height: 900, deviceScaleFactor: 2});
await page.goto(url, {waitUntil: 'networkidle0', timeout: 30000});
await page.evaluate(() => document.fonts.ready);

const markCount = () => page.evaluate((M) => (document.body.innerText.match(new RegExp(`[${M}]`, 'g')) || []).length, MARKS);
await sw.evaluate(() => globalThis.__tashkeelEnsureModel());
const base = await markCount();
await page.evaluate(() => document.documentElement.removeAttribute('data-tashkeel-busy'));
await sw.evaluate(async (u) => {
    const [tab] = await chrome.tabs.query({url: u});
    if (!tab) throw new Error('tab not found: ' + u);
    await globalThis.__tashkeelInvokeWholePage(tab);
}, url);

// wait until the run finishes
const deadline = Date.now() + 30000;
let sawBusy = false;
while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    const busy = await page.evaluate(() => document.documentElement.hasAttribute('data-tashkeel-busy')).catch(() => false);
    const n = await markCount();
    if (busy) sawBusy = true;
    if (!busy && (sawBusy || n > base)) break;
}
await new Promise(r => setTimeout(r, 400));
const total = await markCount();

await page.screenshot({path: join(OUT, 'news-full-after.png'), type: 'png'});
console.log(`marks: ${base} -> ${total}; wrote raw/news-full-after.png`);
await page.close();
await browser.close();
server.close();
