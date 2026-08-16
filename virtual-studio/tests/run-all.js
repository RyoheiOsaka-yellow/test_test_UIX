// 回帰テスト一括実行: node tests/run-all.js
// 事前準備: npm i (playwright-core) / 必要なら VS_CHROME=<chromiumパス>
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const out = path.join(dir, "output"); // スクリーンショット等の出力先 (gitignore)
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(dir)
  .filter(f => /^(smoke|scrolltest|shots\d+)\.js$/.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const failed = [];
for (const f of files) {
  process.stdout.write(`▶ ${f} ... `);
  try {
    const text = execFileSync(process.execPath, [path.join(dir, f)], {
      cwd: out, encoding: "utf8", timeout: 420000,
    });
    const bad = /Ok: false/.test(text) || text.includes("PAGEERROR") || /ERRORS: \[ '/.test(text);
    if (bad) {
      failed.push(f);
      console.log("FAIL\n" + text);
    } else {
      console.log("ok");
    }
  } catch (e) {
    failed.push(f);
    console.log("CRASH\n" + (e.stdout || "") + (e.stderr || e.message));
  }
}
console.log(failed.length
  ? `\n✗ ${failed.length}/${files.length} failed: ${failed.join(", ")}`
  : `\n✓ all ${files.length} tests passed`);
process.exit(failed.length ? 1 : 0);
