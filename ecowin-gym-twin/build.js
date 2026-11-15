// 1つのHTMLにまとめる： node build.js  →  dist/ecowin-gym-twin.html（そのまま開ける）
const fs = require('fs'), path = require('path');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  if (/^https?:/.test(src)) return m;
  return '<script>\n' + fs.readFileSync(path.join(__dirname, src), 'utf8').replace(/<\/script/g, '<\\/script') + '\n</script>';
});
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/ecowin-gym-twin.html'), html);
console.log('dist/ecowin-gym-twin.html', (html.length / 1024).toFixed(0) + ' KB');
