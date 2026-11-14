#!/usr/bin/env python3
"""同梱ライブラリのライセンス一覧を 1 か所（この表）で管理し、
  - THIRD_PARTY_NOTICES.md（配布物に添える表示）
  - js/data/licenses.js（アプリ内の「ライセンス」ダイアログ用。全文つき）
を作る。全文は licenses/ に置いたファイルを読む。  実行: python3 tools/build_licenses.py"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent; LIC = ROOT / 'licenses'
# name, version, license, 用途, 同梱先（online = CDN から読込 / offline = オフライン版に同梱）, URL, 全文ファイル, 補足
ITEMS = [
 ('three.js', '0.180.0', 'MIT', '3D 表示・各種 3D 形式の読込と書出し', 'offline', 'https://github.com/mrdoob/three.js', 'three_LICENSE.txt', ''),
 ('fflate（three.js 同梱）', '0.8.x', 'MIT', 'ZIP の読み書き', 'both', 'https://github.com/101arrowz/fflate', 'fflate_LICENSE.txt', ''),
 ('pdf-lib', '1.17.1', 'MIT', 'PDF 帳票の生成', 'offline', 'https://github.com/Hopding/pdf-lib', 'pdf-lib_LICENSE.md', ''),
 ('fontkit（@pdf-lib/fontkit）', '1.1.1', 'MIT', 'PDF へのフォント埋込', 'offline', 'https://github.com/Hopding/fontkit', 'fontkit_LICENSE.txt', ''),
 ('harfbuzzjs', '0.4.6', 'MIT', 'フォントのサブセット化', 'offline', 'https://github.com/harfbuzz/harfbuzzjs', 'harfbuzzjs_LICENSE.txt', ''),
 ('SheetJS (xlsx)', '0.18.5', 'Apache-2.0', 'Excel の読み書き', 'offline', 'https://github.com/SheetJS/sheetjs', 'SheetJS_LICENSE_Apache-2.0.txt', ''),
 ('PDF.js (pdfjs-dist)', '4.6.82', 'Apache-2.0', '図面 PDF の読込', 'offline', 'https://github.com/mozilla/pdf.js', 'pdfjs_LICENSE_Apache-2.0.txt', ''),
 ('Tesseract.js', '5.1.1', 'Apache-2.0', '図面注記の OCR', 'offline', 'https://github.com/naptha/tesseract.js', 'tesseract.js_LICENSE.md', ''),
 ('tesseract.js-core / tessdata_fast（eng・jpn）', '5.1.1 / 4.0.0', 'Apache-2.0', 'OCR エンジンと学習データ', 'offline', 'https://github.com/naptha/tesseract.js-core', 'tesseract.js-core_LICENSE.txt', ''),
 ('web-ifc', '0.0.66', 'MPL-2.0', 'IFC の読込', 'offline', 'https://github.com/ThatOpen/engine_web-ifc', 'web-ifc_LICENSE_MPL-2.0.md', '改変せずに同梱。ソースは左記 URL で入手できます（MPL-2.0 3.2 条）'),
 ('occt-import-js', '0.0.23', 'LGPL-2.1', 'STEP・IGES・BREP の読込', 'offline', 'https://github.com/kovacsv/occt-import-js', 'occt-import-js_LICENSE.md', '改変せずに同梱。独立した WASM として動的に読み込み、利用者が差し替えられます（下記「LGPL ライブラリの差し替え」）'),
 ('Open CASCADE Technology（occt-import-js に含まれる）', '7.x', 'LGPL-2.1 + Open CASCADE exception 1.0', 'CAD カーネル', 'offline', 'https://github.com/Open-Cascade-SAS/OCCT', 'OpenCASCADE_LGPL-2.1.txt', '例外条項の全文は licenses/OpenCASCADE_LGPL_EXCEPTION.txt'),
 ('UTIF.js', '3.1.0', 'MIT', 'TIFF の読込', 'offline', 'https://github.com/photopea/UTIF.js', 'UTIF_LICENSE.txt', ''),
 ('pako', '1.0.11', 'MIT AND Zlib', 'TIFF の圧縮展開', 'offline', 'https://github.com/nodeca/pako', 'pako_LICENSE.txt', ''),
 ('Noto Sans JP（JIS サブセット）', '—', 'SIL OFL-1.1', 'PDF 帳票の日本語フォント', 'both', 'https://github.com/notofonts/noto-cjk', 'NotoSansJP_OFL-1.1.txt', 'フォント名を変えずにサブセット化して埋込'),
 ('Poly Haven の HDRI・テクスチャ', '—', 'CC0-1.0', '環境光・材質', 'offline（スタジオ HDRI のみ同梱）', 'https://polyhaven.com/license', None, 'パブリックドメイン相当。表示義務なし'),
]
LGPL_NOTE = """**LGPL ライブラリ（occt-import-js / Open CASCADE）の差し替え**
- このライブラリは ANGLEX 本体と結合せず、STEP・IGES・BREP を読むときだけ、独立したファイル（JavaScript と WASM）として読み込みます。
- 差し替え方法 1（画面から）: ヘルプ →「ライセンス」→「STEP 読込ライブラリを差し替える」で、お手持ちの `occt-import-js.js` と `occt-import-js.wasm` を選ぶと、その場でそちらを使います。
- 差し替え方法 2（作り直し）: `vendor/occt/` の 2 ファイルを置き換え、`python3 tools/build_single.py --offline` を実行すると、差し替えたライブラリを同梱した単一 HTML ができます（ビルドに必要なスクリプトは配布物に含めます）。
- 同梱しない版: `python3 tools/build_single.py --offline --without-occt` で、このライブラリを含まないオフライン版を作れます（STEP・IGES・BREP の読込だけが使えなくなります）。
- ソースコード: https://github.com/kovacsv/occt-import-js （v0.0.23）、https://github.com/Open-Cascade-SAS/OCCT
"""
def main():
    md = ['# 同梱・利用している第三者ソフトウェア（THIRD PARTY NOTICES）', '', 'ANGLEX は下記のオープンソース ソフトウェアとデータを利用しています。全文は `licenses/` にあり、アプリの「ヘルプ → ライセンス」でも読めます。', '通常版（オンライン）は CDN から読み込み、オフライン版は単一 HTML に同梱しています。', '', '| ソフトウェア | 版 | ライセンス | 用途 | 入手元 | 補足 |', '|---|---|---|---|---|---|']
    js = []
    for name, ver, lic, use, where, url, fn, note in ITEMS:
        md.append(f'| {name} | {ver} | {lic} | {use} | {url} | {note} |')
        text = (LIC / fn).read_text(encoding='utf-8', errors='replace') if fn and (LIC / fn).exists() else ''
        js.append({'name': name, 'version': ver, 'license': lic, 'use': use, 'url': url, 'note': note, 'text': text})
    md += ['', LGPL_NOTE, '', '本表示は、各ライセンスが求める著作権表示・ライセンス文の添付を満たすためのものです。製品として再配布する場合の最終判断は、貴社の法務・知財部門でご確認ください。', '']
    (ROOT / 'THIRD_PARTY_NOTICES.md').write_text('\n'.join(md), encoding='utf-8')
    exc = (LIC / 'OpenCASCADE_LGPL_EXCEPTION.txt').read_text(encoding='utf-8')
    (ROOT / 'js' / 'data' / 'licenses.js').write_text('// 自動生成: tools/build_licenses.py（licenses/ の全文を取り込む）。手で編集しない\nexport const LICENSES = ' + json.dumps(js, ensure_ascii=False) + ';\nexport const OCCT_EXCEPTION = ' + json.dumps(exc, ensure_ascii=False) + ';\nexport const LGPL_NOTE = ' + json.dumps(LGPL_NOTE, ensure_ascii=False) + ';\n', encoding='utf-8')
    print('wrote THIRD_PARTY_NOTICES.md and js/data/licenses.js', len(js), 'items')
if __name__ == '__main__': main()
