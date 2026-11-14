// 対応形式の一覧（読込・書出し）: 1 か所に定義し、ダイアログ・件数表示・テスト・資料で共用する
import { h, modal, table, tabs, toast } from './common.js';
import { exportGLTF, exportDXF, exportIFCJSON, exportProject } from './exports.js';
import { exportIFC4, exportOBJ, exportSTL, exportPLY, exportDXF3D, exportFabSVG, exportNC1, exportPartsJSON, exportHolesCSV, exportPNG, withLod } from './exportsMore.js';
import { exportSimReady } from './simready.js';
import { exportWeightPDF, exportWeightXLSX, exportWeightCSV } from './reports.js';
// how: direct = ブラウザ内で直接読む / server = サーバー版の変換機能が必要 / trial = 試験対応
export const IMPORT_FORMATS = [
  { g: '図面（2D）', name: 'DXF', ext: ['dxf'], how: 'direct', gets: '線・円・文字・レイヤ → 部材認識' },
  { g: '図面（2D）', name: 'PDF（ベクタ／スキャン）', ext: ['pdf'], how: 'direct', gets: '文字・線、または画像としてベクタ化 + OCR' },
  { g: '図面（2D）', name: 'SVG', ext: ['svg'], how: 'direct', gets: '線・矩形・円・パス・文字 → 部材認識', isNew: true },
  { g: '図面（2D）', name: '画像（PNG / JPEG / BMP / WebP / GIF / AVIF）', ext: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'avif'], how: 'direct', gets: 'ベクタ化（直線・矩形・円）+ 限定 OCR', newExt: ['gif', 'avif'] },
  { g: '図面（2D）', name: 'TIFF（スキャナ標準）', ext: ['tif', 'tiff'], how: 'direct', gets: '最大ページを展開してベクタ化 + OCR', isNew: true },
  { g: '図面（2D）', name: 'DWG / JWW / JWC / SXF（SFC・P21）/ DGN', ext: ['dwg', 'jww', 'jwc', 'sfc', 'p21', 'dgn'], how: 'server', gets: 'DXF へ変換して読込' },
  { g: '表・リスト', name: '部材リスト CSV / TSV', ext: ['csv', 'tsv'], how: 'direct', gets: '仕様・長さ・数量・符号・備考の列 → 部材', isNew: true },
  { g: '表・リスト', name: '部材リスト Excel', ext: ['xlsx', 'xls'], how: 'direct', gets: '拾い出し表をそのまま部材に', isNew: true },
  { g: 'BIM・CAD（3D）', name: 'IFC', ext: ['ifc', 'ifczip'], how: 'direct', gets: '形状と属性 → 参照モデル + 部材候補' },
  { g: 'BIM・CAD（3D）', name: 'STEP', ext: ['step', 'stp'], how: 'direct', gets: '立体 → 参照モデル。鋼材の立体は部材へ自動変換（断面・長さ・穴）', isNew: true },
  { g: 'BIM・CAD（3D）', name: 'IGES', ext: ['iges', 'igs'], how: 'direct', gets: '立体 → 参照モデル。鋼材の立体は部材へ自動変換', isNew: true },
  { g: 'BIM・CAD（3D）', name: 'BREP（OpenCASCADE）', ext: ['brep'], how: 'direct', gets: '立体 → 参照モデル。鋼材の立体は部材へ自動変換', isNew: true },
  { g: 'BIM・CAD（3D）', name: 'RVT / RFA / SKP / 3DM', ext: ['rvt', 'rfa', 'skp', '3dm'], how: 'server', gets: 'IFC・glTF へ変換して読込' },
  { g: '3D メッシュ', name: 'glTF / GLB', ext: ['glb', 'gltf'], how: 'direct', gets: '参照モデル（節点名から部材候補）' },
  { g: '3D メッシュ', name: 'OBJ', ext: ['obj'], how: 'direct', gets: '参照モデル。鋼材の立体は部材へ自動変換' },
  { g: '3D メッシュ', name: 'STL', ext: ['stl'], how: 'direct', gets: '参照モデル。鋼材の立体は部材へ自動変換' },
  { g: '3D メッシュ', name: 'FBX', ext: ['fbx'], how: 'direct', gets: '参照モデル' },
  { g: '3D メッシュ', name: 'PLY', ext: ['ply'], how: 'direct', gets: '参照モデル（点群・メッシュ）', isNew: true },
  { g: '3D メッシュ', name: '3MF', ext: ['3mf'], how: 'direct', gets: '参照モデル', isNew: true },
  { g: '3D メッシュ', name: 'Collada', ext: ['dae'], how: 'direct', gets: '参照モデル', isNew: true },
  { g: '3D メッシュ', name: '3DS', ext: ['3ds'], how: 'direct', gets: '参照モデル', isNew: true },
  { g: '加工・その他', name: 'DSTV NC', ext: ['nc1', 'nc'], how: 'direct', gets: '形鋼 1 本（断面・長さ・穴・長穴）→ 単材', isNew: true },
  { g: '加工・その他', name: 'ZIP（まとめて読込）', ext: ['zip'], how: 'direct', gets: '中の対応ファイルを順に読込（30 件まで）', isNew: true },
  { g: '加工・その他', name: 'ANGLEX プロジェクト', ext: ['json', 'anglex'], how: 'direct', gets: 'モデル・確認状態・視点を復元' },
];
export const EXPORT_FORMATS = [
  { g: 'BIM・CAD 連携', id: 'ifc4', mesh: true, name: 'IFC4', ext: 'ifc', note: 'BIM ソフト向け。形鋼・板・管は断面の押し出し＋穴は開口（鋼材として扱える）。属性は仕様・材質・質量・穴', run: app => exportIFC4(app, { geometry: ifcSel.value }), isNew: true },
  { g: 'BIM・CAD 連携', id: 'dxf3d', mesh: true, name: 'DXF 3D（3DFACE）', ext: 'dxf', note: 'CAD で立体として開く。部材ごとにレイヤ', run: app => exportDXF3D(app), isNew: true },
  { g: 'BIM・CAD 連携', id: 'dxf', name: 'DXF 加工図', ext: 'dxf', note: '板ごとの外形と穴の展開図（2D）', run: app => exportDXF(app) },
  { g: 'BIM・CAD 連携', id: 'fabsvg', name: '加工図 SVG', ext: 'svg', note: '展開図をブラウザ・Illustrator・Inkscape で開く', run: app => exportFabSVG(app), isNew: true },
  { g: 'BIM・CAD 連携', id: 'ifcjson', name: 'IFC-JSON（属性のみ）', ext: 'json', note: '社内システム向けの属性データ。形状なし。BIM ソフトでは開けません', run: app => exportIFCJSON(app) },
  { g: '3D 表示・製作', id: 'glb', mesh: true, name: 'glTF / GLB', ext: 'glb', note: '3D ビューア・Web・Blender', run: app => exportGLTF(app) },
  { g: '3D 表示・製作', id: 'obj', mesh: true, name: 'OBJ', ext: 'obj', note: '汎用の 3D 形式（Z 上・mm）', run: app => exportOBJ(app), isNew: true },
  { g: '3D 表示・製作', id: 'stl', mesh: true, name: 'STL', ext: 'stl', note: '3D プリンタ・解析ソフト（Z 上・mm）', run: app => exportSTL(app), isNew: true },
  { g: '3D 表示・製作', id: 'ply', mesh: true, name: 'PLY', ext: 'ply', note: '点群・メッシュ処理ソフト', run: app => exportPLY(app), isNew: true },
  { g: '3D 表示・製作', id: 'usdz', mesh: true, name: 'USDZ', ext: 'usdz', note: 'iPhone / iPad の AR 表示、Omniverse', run: app => exportSimReady(app, { usdzOnly: true }), isNew: true },
  { g: '3D 表示・製作', id: 'simready', name: 'SimReady パッケージ', ext: 'zip', note: 'USD・USDZ・GLB・テクスチャ・部品表（質量・重心）', run: app => exportSimReady(app) },
  { g: '3D 表示・製作', id: 'png', name: 'PNG 画像（4K）', ext: 'png', note: '今の視点の 3D を 3840×2160 で', run: app => exportPNG(app), isNew: true },
  { g: '加工データ', id: 'nc1', name: 'DSTV NC', ext: 'zip', note: '形鋼・板ごとの .nc1（外形・穴・長穴）。照合テストピースと照合シート（PDF）付き。機械の基準に合わせる設定あり', run: app => exportNC1(app), isNew: true },
  { g: '加工データ', id: 'holes', name: '穴座標 CSV', ext: 'csv', note: '面・位置・径の一覧（NC プログラム・検査表の元データ）', run: app => exportHolesCSV(app), isNew: true },
  { g: '加工データ', id: 'parts', name: '部品 JSON', ext: 'json', note: '部品リスト（配置・穴・溶接）。別エンジン・社内システム向け', run: app => exportPartsJSON(app), isNew: true },
  { g: '帳票・表', id: 'wpdf', name: '重量計算書 PDF', ext: 'pdf', note: '', run: app => exportWeightPDF(app) },
  { g: '帳票・表', id: 'wxlsx', name: '重量計算書 Excel（数式入り）', ext: 'xlsx', note: '', run: app => exportWeightXLSX(app) },
  { g: '帳票・表', id: 'wcsv', name: '重量計算書 CSV', ext: 'csv', note: '', run: app => exportWeightCSV(app) },
  { g: '保存', id: 'project', name: 'ANGLEX プロジェクト', ext: 'json', note: 'モデル・確認状態・視点の全データ（再読込できます）', run: app => exportProject(app) },
];
export const formatCounts = () => ({ importKinds: IMPORT_FORMATS.length, importExts: IMPORT_FORMATS.reduce((n, f) => n + f.ext.length, 0), importDirect: IMPORT_FORMATS.filter(f => f.how !== 'server').reduce((n, f) => n + f.ext.length, 0), exportKinds: EXPORT_FORMATS.length, importNew: IMPORT_FORMATS.filter(f => f.isNew).length, exportNew: EXPORT_FORMATS.filter(f => f.isNew).length });
const HOW = { direct: ['ok', 'そのまま読める'], server: ['ghost', 'サーバー版で変換'], trial: ['warn', '試験対応'] };
export function openFormats(app, tab = 'export') {
  const c = formatCounts(); const newChip = () => h('span', { class: 'chip ok', style: { marginLeft: '6px' } }, '新');
  const impBody = () => { const rows = []; let g = null; for (const f of IMPORT_FORMATS) { rows.push([f.g === g ? '' : h('b', {}, f.g), h('span', {}, f.name, f.isNew ? newChip() : null), h('span', { class: 'mono small' }, f.ext.map(e => '.' + e).join(' ')), h('span', { class: 'chip ' + HOW[f.how][0] }, HOW[f.how][1]), f.gets]); g = f.g; } return h('div', {}, h('p', { class: 'muted small' }, `${c.importKinds} 種類・拡張子 ${c.importExts} 個（うち ${c.importDirect} 個はこの画面だけで読めます）。ファイルを 3D 画面へドロップするか、「読込」から選びます。ZIP にまとめて一度に読むこともできます。`), table(['分類', '形式', '拡張子', '読み方', '取り込まれるもの'], rows), h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn primary', onClick: () => { m.close(); (document.querySelector('#btnImport') || document.querySelector('#fileInput'))?.click(); } }, 'ファイルを選んで読込'))); };
  const lodSel = h('select', { class: 'rsel', title: '3D 形式（IFC4・DXF 3D・glTF・OBJ・STL・PLY・USDZ）の形状の細かさ' }, h('option', { value: '300', selected: true }, '軽量（ねじ山・ビードの波紋を省く）'), h('option', { value: '400' }, '表示のまま（最も細かい・ファイル大）'), h('option', { value: '200' }, '概略（溶接なし・最も軽い）'));
  const ifcSel = h('select', { class: 'rsel', title: 'IFC4 の形状の出し方' }, h('option', { value: 'swept', selected: true }, '鋼材として（断面の押し出し＋穴は開口）'), h('option', { value: 'mesh' }, '見た目どおり（すべて面の集まり）'));
  const expBody = () => { const wrap = h('div', {}, h('p', { class: 'muted small' }, `${c.exportKinds} 種類。見積書・加工指示書・分解図は、見積の画面と部材のメニューから出せます。`), h('div', { class: 'fmt-lod' }, h('span', {}, '3D 形式の詳細度: '), lodSel, h('span', { style: { marginLeft: '14px' } }, 'IFC4 の形状: '), ifcSel, h('button', { class: 'btn sm', style: { marginLeft: 'auto' }, onClick: () => import('./licenses.js').then(x => x.openLicenses(app)) }, 'ライセンス'))); let g = null, grid = null; for (const f of EXPORT_FORMATS) { if (f.g !== g) { wrap.append(h('div', { class: 'fmt-group' }, f.g)); grid = h('div', { class: 'fmt-grid' }); wrap.append(grid); g = f.g; } grid.append(h('button', { class: 'fmt-card' + (f.trial ? ' trial' : ''), 'data-fmt': f.id, title: f.note, onClick: async () => { try { if (f.mesh) await withLod(app, +lodSel.value, () => f.run(app)); else await f.run(app); } catch (e) { console.error(e); toast('書出し失敗: ' + e.message, 'bad'); } } }, h('div', { class: 'fmt-name' }, f.name, h('span', { class: 'fmt-ext' }, '.' + f.ext), f.isNew ? newChip() : null), h('div', { class: 'fmt-note' }, f.note))); } return wrap; };
  const m = modal({ title: '対応形式（読込・書出し）', wide: true, cls: 'formats', body: tabs([{ label: `書出し（${c.exportKinds} 種類）`, body: expBody }, { label: `読込（${c.importKinds} 種類）`, body: impBody }], tab === 'import' ? 1 : 0) }); return m;
}
