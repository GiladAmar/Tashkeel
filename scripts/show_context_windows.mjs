// Show exactly what the model sees in one pass: how a paragraph is split
// into the fixed-width character windows the network is fed (≤ MAX_INPUT
// code points each, broken at word boundaries).
// Usage: node scripts/show_context_windows.mjs
import {split_windows, MODEL_LEN, MAX_INPUT} from '../text_encoding.mjs';

const paragraph =
    'اجتمع وزراء الحكومة صباح اليوم في جلسة طويلة لمناقشة ميزانية التعليم ' +
    'للعام المقبل، وتقرر في نهايتها زيادة الاستثمار في المدارس الابتدائية في ' +
    'مختلف أنحاء البلاد. ورحب أولياء الأمور بالقرار لكنهم طلبوا التأكد من أن ' +
    'الميزانية ستصل فعلا إلى الصفوف نفسها.';

const windows = split_windows(paragraph);

console.log(`paragraph: ${[...paragraph].length} characters -> ${windows.length} window(s) of up to ${MAX_INPUT} (model timesteps: ${MODEL_LEN})\n`);
windows.forEach((w, i) => {
    const words = w.trim().split(/\s+/).filter(Boolean).length;
    console.log(`window ${i + 1}: ${words} words, ${[...w].length} chars`);
    console.log(`  ${w.trim()}`);
});
