// virtual-studio を1ファイルHTMLにバンドルする: node tools/build-bundle.js [artifact出力パス]
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
const js = {};
for (const name of ["data", "equipment_db", "engine", "dna", "intent", "studio3d", "app"]) {
  js[name] = fs.readFileSync(path.join(root, `js/${name}.js`), "utf8");
}

let bundled = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);
for (const name of ["data", "equipment_db", "engine", "dna", "intent", "studio3d", "app"]) {
  bundled = bundled.replace(`<script src="js/${name}.js"></script>`, `<script>\n${js[name]}\n</script>`);
}

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/virtual-studio-standalone.html"), bundled);
console.log("standalone:", bundled.length, "bytes ->", path.join(root, "dist/virtual-studio-standalone.html"));

// Artifact用 (doctype/html/head/bodyラッパー無し) — 出力パスを引数で指定した時のみ
const artifactPath = process.argv[2];
if (artifactPath) {
  const bodyMatch = bundled.match(/<body>([\s\S]*)<\/body>/);
  const artifact = `<title>Virtual Studio — 仮想撮影スタジオ</title>\n<style>\n${css}\n</style>\n${bodyMatch[1]}`;
  fs.writeFileSync(artifactPath, artifact);
  console.log("artifact:", artifact.length, "bytes ->", artifactPath);
}
