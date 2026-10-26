// クラウド変換（DWG / JWW / RVT / SFC・P21(SXF) / DGN）: ブラウザで直接パースできない形式はサーバ側変換 API に委ねる。
// 既定は `/api/convert`（server/server.js）。環境変数 ANGLEX_CONVERTER_URL が設定されていれば ODA File Converter 等へ中継。
export const CONVERTIBLE = { dwg: 'DXF へ変換（ODA File Converter / LibreDWG）', jww: 'DXF へ変換（JWW→DXF コンバータ）', jwc: 'DXF へ変換', sfc: 'SXF → DXF 変換', p21: 'SXF → DXF 変換', dgn: 'DGN → DXF 変換', rvt: 'IFC へ変換（Revit / Forge Model Derivative）', rfa: 'IFC へ変換', skp: 'glTF へ変換', '3dm': 'glTF へ変換', dwf: 'DXF へ変換', dxb: 'DXF へ変換' };
export async function convertViaServer(file, apiBase = '') {
  const ext = file.name.split('.').pop().toLowerCase(); const fd = new FormData(); fd.append('file', file); fd.append('to', ['rvt', 'rfa'].includes(ext) ? 'ifc' : ['skp', '3dm'].includes(ext) ? 'glb' : 'dxf');
  let res; try { res = await fetch(apiBase + '/api/convert', { method: 'POST', body: fd }); } catch (e) { throw new Error('変換サーバに接続できません（server/server.js を起動し、ANGLEX_CONVERTER_URL を設定してください）'); }
  if (res.status === 501) { const j = await res.json().catch(() => ({})); throw new Error(j.message || `この環境では ${ext.toUpperCase()} の自動変換が未設定です。DXF/IFC で書き出して読み込んでください。`); }
  if (!res.ok) throw new Error('変換に失敗しました: ' + res.status);
  const blob = await res.blob(); const name = file.name.replace(/\.[^.]+$/, '.' + (res.headers.get('x-anglex-format') || 'dxf')); return new File([blob], name, { type: blob.type });
}
