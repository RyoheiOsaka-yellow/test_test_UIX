// v4.3: ロケ地 (演出) — 地域ライブラリ / Maps座標 / 太陽計算 / プロンプト化
// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(700);

  // ============ ① 未設定ならプロンプトは従来どおり (非破壊) ============
  const untouched = await page.evaluate(() => {
    const c = state.cuts[0];
    const before = PROMPT_MODELS.map(m => generatePrompt(c, m.id)).join('|');
    c.location.camBearing = 90;                 // ロケ地未設定のままの変更
    const after = PROMPT_MODELS.map(m => generatePrompt(c, m.id)).join('|');
    return { active: locActive(c), same: before === after };
  });
  console.log({ ...untouched, untouchedOk: !untouched.active && untouched.same });

  // ============ ② 太陽計算の妥当性 (既知の条件で検証) ============
  const sun = await page.evaluate(() => {
    // 東京 2026-06-21 (夏至) の正午前後: 南中は高く、方位はほぼ南(180°)
    const noon = sunPosition(35.68, 139.76, new Date(Date.UTC(2026, 5, 21, 3, 0)));  // 12:00 JST = 03:00 UTC
    // 同日の日の出は東寄り(60-70°)で高度は低い
    const dawn = sunPosition(35.68, 139.76, new Date(Date.UTC(2026, 5, 20, 19, 30))); // 04:30 JST
    // 南半球 (シドニー) の冬至正午は北寄り(0°付近)
    const syd = sunPosition(-33.87, 151.2, new Date(Date.UTC(2026, 5, 21, 2, 0)));   // 12:00 AEST
    const ev = sunEvents(35.68, 139.76, '2026-06-21');
    const polar = sunEvents(78.2, 15.6, '2026-06-21');   // スヴァールバル諸島 = 白夜
    return {
      noonEl: +noon.elevation.toFixed(1), noonAz: Math.round(noon.azimuth),
      dawnEl: +dawn.elevation.toFixed(1), dawnAz: Math.round(dawn.azimuth),
      sydAz: Math.round(syd.azimuth), sydEl: +syd.elevation.toFixed(1),
      rise: ev.rise, set: ev.set, maxEl: +ev.maxEl.toFixed(1), polar: polar.polar,
    };
  });
  console.log({ ...sun,
    sunOk: sun.noonEl > 70 && Math.abs(sun.noonAz - 180) < 20     // 夏至の東京は南中78°前後
      && sun.dawnEl > -1 && sun.dawnEl < 15 && sun.dawnAz > 40 && sun.dawnAz < 90  // 日の出直後は屈折込みでほぼ0°
      && (sun.sydAz < 30 || sun.sydAz > 330) && sun.sydEl > 0 && sun.sydEl < 40
      && /^04:/.test(sun.rise) && /^19:/.test(sun.set) && sun.maxEl > 75
      && sun.polar.includes('白夜') });

  // ============ ③ Google Maps URL / 座標のパース ============
  const parse = await page.evaluate(() => ({
    at: parseMapsUrl('https://www.google.com/maps/@35.6586,139.7454,17z'),
    place: parseMapsUrl('https://www.google.com/maps/place/Tokyo+Tower/@35.6585,139.7454,17z/data=!3m1!4b1!4m6!3d35.6585805!4d139.7454329'),
    plain: parseMapsUrl('35.6586, 139.7454'),
    short: parseMapsUrl('https://maps.app.goo.gl/abcdef'),
    junk: parseMapsUrl('ここは新宿です'),
  }));
  console.log({
    at: parse.at && [parse.at.lat, parse.at.lng],
    placeName: parse.place && parse.place.name,
    placeCoord: parse.place && parse.place.lat,
    plain: parse.plain && parse.plain.lng,
    shortErr: !!(parse.short && parse.short.error),
    junkErr: !!(parse.junk && parse.junk.error),
    parseOk: parse.at.lat === 35.6586 && parse.place.name === 'Tokyo Tower'
      && Math.abs(parse.place.lat - 35.6585805) < 1e-6 && parse.plain.lng === 139.7454
      && !!parse.short.error && !!parse.junk.error,
  });

  // ============ ④ ロケ地ライブラリから適用 → プロンプト化 ============
  await page.click('#btnScriptPage');
  await page.waitForTimeout(500);
  await page.click('[data-scloclib="0"]');
  await page.waitForTimeout(400);
  const lib = await page.evaluate(() => ({
    shown: !document.getElementById('locOverlay').hidden,
    cards: document.querySelectorAll('.loc-card').length,
    regions: document.querySelectorAll('#locRegion option').length,
  }));
  // 地域で絞り込み → 検索
  await page.selectOption('#locRegion', 'jp');
  await page.waitForTimeout(300);
  const jpOnly = await page.evaluate(() => document.querySelectorAll('.loc-card').length);
  await page.fill('#locSearch', '路地');
  await page.waitForTimeout(300);
  const searched = await page.evaluate(() => document.querySelectorAll('.loc-card').length);
  await page.click('[data-locapply="jp-alley"]');
  await page.waitForTimeout(400);
  const applied = await page.evaluate(() => {
    const c = state.cuts[0];
    const p = generatePrompt(c, 'seedance');
    return {
      preset: c.location.presetId,
      active: locActive(c),
      block: p.includes('LOCATION: a narrow Tokyo back alley'),
      aspects: p.includes('signage: dense vertical signage in Japanese'),
      negative: p.includes('LOCATION NEGATIVE') && p.includes('no Latin/English shop signage'),
      closed: document.getElementById('locOverlay').hidden,
    };
  });
  console.log({ ...lib, jpOnly, searched, ...applied,
    libOk: lib.shown && lib.cards > 15 && lib.regions === 9 && jpOnly === 5 && searched < jpOnly
      && applied.preset === 'jp-alley' && applied.active && applied.block && applied.aspects && applied.negative && applied.closed });

  // ============ ⑤ 座標→太陽→スタジオの太陽配置 (ロケ地とスタジオの連動) ============
  const studio = await page.evaluate(() => {
    const c = state.cuts[0];
    const mapsIn = document.querySelector('[data-scmaps="0"]');
    mapsIn.value = 'https://www.google.com/maps/@35.6936,139.7047,18z';
    mapsIn.dispatchEvent(new Event('change', { bubbles: true }));
    const gotCoords = !!c.location.coords;
    c.location.date = '2026-06-21';
    c.location.time = '18:40';       // 日没直前 = 低い太陽 (夏至の東京は19時ごろ日没)
    c.location.camBearing = 270;     // カメラは西を向く → 夕日は逆光になるはず
    renderScriptPage();
    const rel = locSunRelative(c);
    const before = c.items.filter(i => i.type === 'sun').length;
    const ok = applySunToStudio(c);
    const sunItem = c.items.find(i => i.type === 'sun');
    return {
      gotCoords, ok,
      backlit: Math.abs(rel.rel) < 45,           // 西向き夕方 → 逆光
      elevation: +rel.elevation.toFixed(1),
      created: before === 0 && !!sunItem,
      warm: sunItem.colorTemp <= 3600,           // 低い太陽は暖色になる
      height: sunItem.height,
      inPrompt: generatePrompt(c, 'seedance').includes('SUN: natural sun from'),
    };
  });
  console.log({ ...studio,
    studioOk: studio.gotCoords && studio.ok && studio.backlit && studio.elevation > 0 && studio.elevation < 12
      && studio.created && studio.warm && studio.height > 0 && studio.inPrompt });

  // ============ ⑥ 指示書とcanonicalに載る ============
  const out = await page.evaluate(() => {
    const doc = buildInstructionDoc();
    const shot = cutToCanonicalShot(state.cuts[0], 0, 'PRJ_T');
    const back = cutFromCanonicalShot(shot);
    return {
      docLoc: doc.includes('<h3>ロケ地</h3>') && doc.includes('東京の裏路地'),
      docSun: doc.includes('当日の太陽') && doc.includes('日の入'),
      docPermit: doc.includes('撮影許可と近隣配慮'),
      canonical: !!shot.location && shot.location.preset_id === 'jp-alley'
        && !!shot.location.sun && shot.location.map_url.includes('google.com/maps'),
      imported: back.location.presetId === 'jp-alley' && back.location.coords.lat === 35.6936
        && back.location.camBearing === 270,
    };
  });
  console.log({ ...out, outOk: Object.values(out).every(Boolean) });

  await page.evaluate(() => document.querySelector('.sc-cut').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.locator('.sc-cut').first().screenshot({ path: 'v43-loc.png' });
  console.log('ERRORS:', errors);
  await browser.close();
})();
