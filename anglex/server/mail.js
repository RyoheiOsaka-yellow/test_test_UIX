// 依存なしの最小 SMTP クライアント（催促メール用）。環境変数: SMTP_HOST, SMTP_PORT(25/587/465), SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE=1(465 の暗黙 TLS)
// 送信先が無い／設定が無いときは送らず、呼び出し側が outbox（ログ）に残す。STARTTLS（587）と AUTH LOGIN / PLAIN に対応
import net from 'node:net'; import tls from 'node:tls';
export function smtpConfigured() { return !!process.env.SMTP_HOST; }
export function sendMail({ to, subject, text, from = process.env.SMTP_FROM || 'anglex@localhost' }) {
  return new Promise((resolve, reject) => {
    const host = process.env.SMTP_HOST, port = +(process.env.SMTP_PORT || (process.env.SMTP_SECURE === '1' ? 465 : 587)), secure = process.env.SMTP_SECURE === '1'; if (!host) return reject(new Error('SMTP_HOST 未設定'));
    const rcpts = [].concat(to).filter(Boolean); if (!rcpts.length) return reject(new Error('宛先なし'));
    let sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port }); let buf = ''; const q = []; let done = false;
    const fail = e => { if (done) return; done = true; try { sock.destroy(); } catch { } reject(e); };
    const write = s => sock.write(s + '\r\n'); const expect = (code) => new Promise((res, rej) => q.push({ code, res, rej }));
    const onLine = line => { const it = q[0]; if (!it) return; if (/^\d{3}-/.test(line)) return; q.shift(); const c = +line.slice(0, 3); if (String(c).startsWith(String(it.code))) it.res(line); else it.rej(new Error('SMTP ' + line)); };
    const attach = s => { s.on('data', d => { buf += d.toString('utf8'); let i; while ((i = buf.indexOf('\r\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 2); onLine(line); } }); s.on('error', fail); };
    attach(sock); sock.setTimeout(20000, () => fail(new Error('SMTP timeout')));
    (async () => {
      await expect(220); write('EHLO anglex.local'); let ehlo = await expect(250);
      if (!secure && /STARTTLS/i.test(buf + ehlo)) { write('STARTTLS'); await expect(220); sock.removeAllListeners('data'); sock = tls.connect({ socket: sock, servername: host }); buf = ''; attach(sock); write('EHLO anglex.local'); await expect(250); }
      if (process.env.SMTP_USER) { write('AUTH LOGIN'); await expect(334); write(Buffer.from(process.env.SMTP_USER).toString('base64')); await expect(334); write(Buffer.from(process.env.SMTP_PASS || '').toString('base64')); await expect(235); }
      write(`MAIL FROM:<${from}>`); await expect(250); for (const r of rcpts) { write(`RCPT TO:<${r}>`); await expect(250); }
      write('DATA'); await expect(354); const enc = s => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`; const body = text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      write([`From: ${from}`, `To: ${rcpts.join(', ')}`, `Subject: ${enc(subject)}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', `Date: ${new Date().toUTCString()}`, '', body, '.'].join('\r\n')); await expect(250); write('QUIT'); done = true; sock.end(); resolve(true);
    })().catch(fail);
  });
}
