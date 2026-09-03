// Shakkala tashkeel dictionaries — generated from the pretrained model's
// input_vocab_to_int and output_int_to_vocab (MIT, Shakkala Project). Do not
// edit by hand; see arabic_model_build/CONTRACT.md and THIRD_PARTY_LICENSES.

// Per-Unicode-character → embedding id. Any char absent here is <UNK> (1).
export const INPUT_VOCAB = {"“":55,"ئ":56,"°":5,"و":6,"ε":7,"ﺇ":57,"ﺈ":58,"ﻧ":102,"\t":8,"‏":60,"ـ":9,"۷":106,"ﺄ":61,"۸":10,"•":62,"ו":64,"ظ":11,"ر":65,"ﻠ":66,"ψ":12,"ﻛ":13,"<GO>":2,"χ":14,"ز":92,"آ":15,"ﺁ":16,"ا":68,"؛":17,"έ":69,"ي":70,"ث":71,"ك":72,"أ":73,"«":74,"ص":75,"υ":20,"ﻹ":21,"ﺔ":76,"ت":22,"…":23,"ό":77,"τ":78,"ش":18,"غ":24,"ﻻ":79,"﴿":25,"ج":59,"σ":27,"ρ":26,"ن":81,"س":82,"ﻵ":83," ":84,"”":85,"‍":31,"ﻓ":33,"ﻴ":88,"ω":89,"ﺌ":90,"‘":34,"κ":35,"γ":80,"ل":29,"ط":93,"ﺂ":96,"ι":36,"ع":95,"ν":63,"ﻷ":98,"ے":37,"ق":38,"خ":19,"ى":39,"­":40,"ح":86,"ώ":103," ":28,"‫":94,"’":41,"–":42,"<EOS>":3,"ﻣ":43,"﴾":44,"ٰ":45,"<UNK>":1,"»":30,"ذ":97,"ﺑ":32,"ﻟ":99,"ف":46,"د":104,"۵":109,"ﺃ":87,"α":47,"م":48,"ه":49,"‬":108,"ؤ":50,"θ":51,"ﺋ":100,"ی":105,"´":110,"ض":111,"<PAD>":0,"​":52,"٪":91,"ί":112,"إ":119,"؟":101,"ﺒ":113,"ο":114,"‰":115,"π":116,"‎":117,"ﮐ":53,"ب":118,"ٱ":67,"μ":54,"ة":107,"ء":120};

export const PAD_ID = 0;
export const UNK_ID = 1;

// class index (argmax over 28 outputs) → the diacritic string to append AFTER
// the character. Structural tokens and the tatweel "no-diacritic" classes
// (0..4 and 8) are blanked to ''. Shadda combinations appear in both code-point
// orders in the training labels, so these are stored as literal strings.
export const DIACRITIC = ["","","","","","َ","ُّ","َّ","","ِّ","ّ","ّْ","ٍّ","ِّ","ٍّ","ٌّ","َّ","ُ","ٌّ","ًّ","ْ","ٍ","ِ","ُّ","ًّ","ٌ","ً","ّّ"];
