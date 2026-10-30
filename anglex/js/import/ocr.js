// 限定 OCR: スキャン図面の文字領域（ベクタ化で残った小さな連結成分のまとまり）だけを Tesseract.js（WASM、ブラウザ内）で読む。
// 読むのは部材仕様（L-50x50x6 / [-75x40x5x7 / FB-6x50 / PL-9x150）・穴注記（2-φ15）・長さ（L=600）の 3 パターンに絞り、
// 読めた文字は DXF の TEXT 相当エンティティとして既存の認識器（recognize.js）へ渡す。全文 OCR はしない（誤読の影響を部材仕様に限定するため）。
// 単一ファイル（オフライン）版では build_single.py がこれらの URL を同梱 data: URL に置換する。言語データは本体で取得して worker へバイト列で渡す（langPath 不要）。
export const OCR_URLS = {
  main: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
  lang: 'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz',
  langJpn: 'https://tessdata.projectnaptha.com/4.0.0_fast/jpn.traineddata.gz',
};
// 日本語で読む語彙（限定）: 仕上げ・溶接・長穴・Uボルト・アンカー。これ以外の日本語は使わない（誤読の影響を加工注記に限定）
export const JPN_VOCAB = /溶融亜鉛|ドブ|HDZ|電気亜鉛|ユニクロ|ステンレス|SUS|サビ止め|錆止め|全周|隅肉|すみ肉|溶接|長穴|Uボルト|Ｕボルト|アンカー|吊ボルト|現場|工場/;
const workers = {}; let failed = null;
function loadScript(src) { return new Promise((res, rej) => { if (globalThis.Tesseract) { res(); return; } const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('OCR ライブラリを読み込めません')); document.head.appendChild(s); }); }
export function ocrFailed() { return failed; }
// worker は 1 つを使い回す（初期化 2〜5 秒）。失敗したらその理由を保持し、以後は OCR を省略
export async function getOcrWorker({ onProgress = null, lang = 'eng' } = {}) {
  if (failed) throw failed; if (workers[lang]) return workers[lang];
  workers[lang] = (async () => {
    await loadScript(OCR_URLS.main); const T = globalThis.Tesseract; if (!T) throw new Error('Tesseract が見つかりません');
    // worker を薄いラッパで起動: 言語データの取得先（CDN or 同梱 data: URL）へ fetch を向け替えてから本体を importScripts する。
    // これで langPath の「ディレクトリ + /eng.traineddata.gz」規約に縛られず、単一ファイル版でも同じ経路で動く
    // blob worker の中では相対 URL が解決できないため絶対 URL に。単一ファイル版の data: URL（数 MB）は importScripts で失敗することがあるので blob: URL に変換して渡す
    const abs = async (u, type) => { if (u.startsWith('data:')) { const b = await (await fetch(u)).blob(); return URL.createObjectURL(new Blob([b], { type })); } return new URL(u, location.href).href; };
    const [workerUrl, coreUrl, langUrl] = await Promise.all([abs(OCR_URLS.worker, 'text/javascript'), abs(OCR_URLS.core, 'text/javascript'), abs(lang === 'jpn' ? OCR_URLS.langJpn : OCR_URLS.lang, 'application/gzip')]);
    // corePath は「ディレクトリ + /tesseract-core-*.js」として解決されるため blob: URL を直接渡せない → importScripts を差し替えてコアの要求を blob: URL へ向ける
    const wrapper = `const LANG=${JSON.stringify(langUrl)},CORE=${JSON.stringify(coreUrl)};const of=self.fetch.bind(self);self.fetch=(u,o)=>(typeof u==='string'&&/(eng|jpn)\.traineddata/.test(u))?of(LANG):of(u,o);const oi=self.importScripts.bind(self);self.importScripts=(...a)=>oi(...a.map(x=>(typeof x==='string'&&/tesseract-core[^/]*\.js$/.test(x))?CORE:x));importScripts(${JSON.stringify(workerUrl)});`;
    const workerPath = URL.createObjectURL(new Blob([wrapper], { type: 'text/javascript' }));
    const w = await T.createWorker(lang, 1, { workerPath, workerBlobURL: false, corePath: 'anglex-core', langPath: 'anglex-lang', cacheMethod: 'none', gzip: true, logger: m => { if (onProgress && m.status) onProgress(m); } });
    await w.setParameters(lang === 'jpn' ? { tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' } : { tessedit_char_whitelist: '0123456789LCPFBMWxX×-=φø.[]/()AS ', tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' });
    return w;
  })().catch(e => { if (lang === 'eng') failed = e; workers[lang] = null; throw e; });
  return workers[lang];
}
// 誤読の正規化: φ は o / 0 / ø / @ / Φ に読まれやすい。「2-o15」「2-015」→「2-φ15」、「o15 穴」→「φ15」。x の揺れは SPEC_RE が吸収する
export function normalizeOcr(s) {
  let t = String(s || '').replace(/[|]/g, '1').replace(/\s+/g, ' ').trim();
  // 数字の並びの中の S→5 / O→0 / B→8（L=S00, 40xSx7）。仕様の頭文字（FB, PL, L）は数字に挟まれないので影響しない
  t = t.replace(/(?<=[\dxX×=\-])S(?=[\dxX×]|\b)/g, '5').replace(/(?<=[\dxX×=\-])O(?=[\dxX×]|\b)/g, '0').replace(/(?<=[\dxX×=])B(?=\d)/g, '8');
  t = t.replace(/(\d)\s*[-‐—–]\s*[oO0øΦ@φ9]\s*(\d{2})\b/g, '$1-φ$2').replace(/(^|[\s(])[oOøΦ@]\s*(\d{2})\b/g, '$1φ$2');
  t = t.replace(/\bL\s*[=＝:]\s*(\d{3,4})\b/g, 'L=$1').replace(/\b([Ll])\s*[-‐—–]\s*(\d{2,3})\s*[xX×*]\s*(\d{2,3})\s*[xX×*]\s*(\d(?:\.\d)?)/g, 'L-$2x$3x$4');
  t = t.replace(/\b(FB|PL|F8|P1)\s*[-‐—–]\s*(\d{1,2})\s*[xX×*]\s*(\d{2,3})/g, (m, a, b, c) => `${a === 'F8' ? 'FB' : a === 'P1' ? 'PL' : a}-${b}x${c}`);
  t = t.replace(/(^|[^A-Za-z\[\]])[-‐—–]?\s*(\d{2,3})\s*[xX×*]\s*(\d{2,3})\s*[xX×*]\s*(\d(?:\.\d)?)\s*[xX×*]\s*(\d(?:\.\d)?)\b/g, (m, a, b, c, d, e) => `${a}[-${b}x${c}x${d}x${e}`); // 先頭の [ が落ちた溝形鋼（4 数値）
  t = t.replace(/[\[\(C]\s*[-‐—–]\s*(\d{2,3})\s*[xX×*]\s*(\d{2,3})\s*[xX×*]\s*(\d(?:\.\d)?)(?:\s*[xX×*]\s*(\d(?:\.\d)?))?/g, (m, a, b, c, d) => `[-${a}x${b}x${c}${d ? 'x' + d : ''}`);
  return t.replace(/\[-\s*\[-/g, '[-');
}
// 図面上の文字領域を読む。regions: [{x0,y0,x1,y1}] 画素座標（canvas 上）。戻り値: [{text, conf, bbox}]
export async function ocrRegions(canvas, regions, { onProgress = null, minConf = 35, targetH = 40, denoise = false, jpn = true } = {}) {
  if (!regions.length) return []; const w = await getOcrWorker({ onProgress }); const out = []; const g = canvas.getContext('2d', { willReadFrequently: true }); const crops = [];
  for (let i = 0; i < regions.length; i++) { const r = regions[i]; const pad = 3; const x0 = Math.max(0, Math.floor(r.x0 - pad)), y0 = Math.max(0, Math.floor(r.y0 - pad)), x1 = Math.min(canvas.width, Math.ceil(r.x1 + pad)), y1 = Math.min(canvas.height, Math.ceil(r.y1 + pad)); const cw = x1 - x0, ch = y1 - y0; if (cw < 6 || ch < 5) continue;
    const k = Math.max(1, Math.min(6, targetH / ch)); const crop = denoise ? medianCrop(g, x0, y0, cw, ch) : canvas; /* メディアンは細い字画を消すため、ごま塩ノイズが多い画像だけに掛ける */ const c = document.createElement('canvas'); c.width = Math.round(cw * k) + 16; c.height = Math.round(ch * k) + 16; const cg = c.getContext('2d'); cg.fillStyle = '#fff'; cg.fillRect(0, 0, c.width, c.height); cg.imageSmoothingEnabled = true; if (denoise) cg.drawImage(crop, 0, 0, cw, ch, 8, 8, Math.round(cw * k), Math.round(ch * k)); else cg.drawImage(canvas, x0, y0, cw, ch, 8, 8, Math.round(cw * k), Math.round(ch * k));
    onProgress?.({ status: 'recognizing', progress: i / regions.length });
    try { const { data } = await w.recognize(c); const text = normalizeOcr(data.text); const conf = Math.round(data.confidence || 0); const rec = { text, conf, bbox: { x0, y0, x1, y1 }, raw: data.text.trim(), lang: 'eng' }; const hit = !!text && conf >= minConf; if (hit) out.push(rec); crops.push({ c, rec, hit, spec: /\b(L|FB|PL)-\d|\[-\d/.test(text) /* 鋼材仕様が読めた行だけ日本語パスを省く（穴注記の行は「アンカー M12」などを拾うため日本語も読む） */ }); } catch (e) { console.error('ocr region', e.message); } }
  // 2 パス目（日本語・限定語彙）: 英数で仕様・穴・長さが読めなかった領域だけを jpn で読み、語彙（仕上げ・溶接・長穴・Uボルト・アンカー）に当たる語が含まれれば採用
  if (jpn) { const todo = crops.filter(x => !x.spec); if (todo.length) { try { const wj = await getOcrWorker({ onProgress, lang: 'jpn' }); for (let i = 0; i < todo.length; i++) { onProgress?.({ status: 'recognizing-jpn', progress: i / todo.length }); const x = todo[i]; try { const { data } = await wj.recognize(x.c); const t = String(data.text || '').replace(/\s+/g, '').trim(); const m = t.match(new RegExp('(' + JPN_VOCAB.source + ')', 'g')); if (!m) continue; const conf = Math.round(data.confidence || 0); const text = normalizeJpn(t); if (x.hit) { x.rec.text = x.rec.text + ' ' + text; x.rec.jpn = m.join('/'); } else out.push({ text, conf: Math.max(conf, minConf), bbox: x.rec.bbox, raw: data.text.trim(), lang: 'jpn', jpn: m.join('/') }); } catch (e) { console.error('ocr jpn', e.message); } } } catch (e) { console.warn('jpn OCR を省略: ' + e.message); } } }
  return out;
}
// 日本語 OCR の正規化: 語彙に当たる語と、それに付く数値だけ残す（「溶融亜鉛めっき HDZ55」「▷6 全周」「長穴 12x25」「Uボルト 50A」「アンカー M12」）
export function normalizeJpn(t) { const keep = []; const re = new RegExp('(' + JPN_VOCAB.source + ')', 'g'); let m; while ((m = re.exec(t))) keep.push(m[1]); const nums = []; const hdz = t.match(/HDZ\s*(\d{2})/); if (hdz) nums.push('HDZ' + hdz[1]); const slot = t.match(/長穴\s*(\d{1,2})\s*[xX×]\s*(\d{2,3})/); if (slot) nums.push(`長穴 ${slot[1]}x${slot[2]}`); const ub = t.match(/[UＵ]ボルト\s*(\d{2,3})\s*A?/); if (ub) nums.push(`Uボルト ${ub[1]}A`); const an = t.match(/(?:アンカー|ｱﾝｶｰ)\s*[-ー]?\s*(M\s*\d{1,2})/); if (an) an[1] = an[1].replace(/\s+/g, ''); if (an) nums.push(`アンカー ${an[1]}`); const wd = t.match(/[▷△]\s*(\d{1,2})/); if (wd) nums.push(`▷${wd[1]}`); const uniq = [...new Set([...nums, ...keep.filter(k => !nums.some(n => n.includes(k)))])]; return uniq.join(' '); }
// 切り出し領域の 3×3 メディアン（スキャンのごま塩ノイズを文字の形を崩さずに除く）→ グレースケール canvas
function medianCrop(g, x0, y0, cw, ch) { const src = g.getImageData(x0, y0, cw, ch).data; const gray = new Uint8ClampedArray(cw * ch); for (let i = 0, k = 0; i < src.length; i += 4, k++) gray[k] = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000; const out = new Uint8ClampedArray(cw * ch); const win = new Uint8ClampedArray(9);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = Math.min(ch - 1, Math.max(0, y + dy)), xx = Math.min(cw - 1, Math.max(0, x + dx)); win[n++] = gray[yy * cw + xx]; } const a = Array.from(win).sort((p, q) => p - q); out[y * cw + x] = a[4]; }
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const cg = c.getContext('2d'); const id = cg.createImageData(cw, ch); for (let k = 0; k < out.length; k++) { id.data[k * 4] = id.data[k * 4 + 1] = id.data[k * 4 + 2] = out[k]; id.data[k * 4 + 3] = 255; } cg.putImageData(id, 0, 0); return c; }
export async function terminateOcr() { for (const k of Object.keys(workers)) { try { const w = await workers[k]; await w?.terminate(); } catch { } workers[k] = null; } }
