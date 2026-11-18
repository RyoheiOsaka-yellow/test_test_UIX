// Storage on node:sqlite. One file under DATA_DIR. Swap this module for Cloud SQL / Firestore in production.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDb(dir, defaults){
  fs.mkdirSync(dir, { recursive: true });
  const d = new DatabaseSync(path.join(dir, "space.db"));
  d.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT, org TEXT, picture TEXT, avatar TEXT, created INTEGER);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires INTEGER);
    CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT, kind TEXT, shared INTEGER, zone TEXT, orgs TEXT, created INTEGER);
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ch TEXT, uid TEXT, name TEXT, org TEXT, role TEXT, text TEXT, ts INTEGER, src TEXT);
    CREATE INDEX IF NOT EXISTS messages_ch_id ON messages (ch, id);
    CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, in_ts INTEGER, out_ts INTEGER);
    CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, org TEXT, email TEXT, created_by TEXT, created INTEGER, expires INTEGER, uses INTEGER DEFAULT 0);`);
  const ins = d.prepare("INSERT OR IGNORE INTO channels (id, name, kind, shared, zone, orgs, created) VALUES (?, ?, ?, ?, ?, '', ?)");
  for (const c of defaults) ins.run(c.id, c.name, c.kind, c.shared, c.zone, Date.now());
  const q = (sql) => d.prepare(sql);
  const S = {
    getUser: q("SELECT * FROM users WHERE id = ?"),
    upsertUser: q(`INSERT INTO users (id, email, name, role, org, picture, avatar, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, org = excluded.org, picture = excluded.picture`),
    setAvatar: q("UPDATE users SET avatar = ? WHERE id = ?"),
    addSession: q("INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)"),
    getSession: q("SELECT * FROM sessions WHERE token = ?"),
    delSession: q("DELETE FROM sessions WHERE token = ?"),
    purge: q("DELETE FROM sessions WHERE expires < ?"),
    getChannel: q("SELECT * FROM channels WHERE id = ?"),
    listChannels: q("SELECT id, name, kind, shared, zone, orgs FROM channels WHERE kind != 'eq' ORDER BY created, id"),
    addChannel: q("INSERT OR IGNORE INTO channels (id, name, kind, shared, zone, orgs, created) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    dmChannels: q("SELECT DISTINCT ch FROM messages WHERE ch LIKE 'dm:%' AND ch LIKE ? ORDER BY id DESC LIMIT 50"),
    addMessage: q("INSERT INTO messages (ch, uid, name, org, role, text, ts, src) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    history: q("SELECT * FROM messages WHERE ch = ? AND id < ? ORDER BY id DESC LIMIT ?"),
    search: q("SELECT * FROM messages WHERE text LIKE ? ORDER BY id DESC LIMIT ?"),
    openAtt: q("SELECT * FROM attendance WHERE user_id = ? AND out_ts IS NULL ORDER BY id DESC LIMIT 1"),
    checkIn: q("INSERT INTO attendance (user_id, in_ts) VALUES (?, ?)"),
    checkOut: q("UPDATE attendance SET out_ts = ? WHERE user_id = ? AND out_ts IS NULL"),
    attOn: q(`SELECT a.*, u.name, u.org, u.role FROM attendance a JOIN users u ON u.id = a.user_id WHERE a.in_ts >= ? AND a.in_ts < ? ORDER BY a.in_ts`),
    addInvite: q("INSERT INTO invites (code, org, email, created_by, created, expires) VALUES (?, ?, ?, ?, ?, ?)"),
    getInvite: q("SELECT * FROM invites WHERE code = ?"),
    useInvite: q("UPDATE invites SET uses = uses + 1 WHERE code = ?"),
    listInvites: q("SELECT code, org, email, created, expires, uses FROM invites ORDER BY created DESC LIMIT 100"),
  };
  return {
    raw: d,
    getUser: (id) => S.getUser.get(id),
    upsertUser: (u) => S.upsertUser.run(u.id, u.email, u.name, u.role, u.org, u.picture, u.avatar || "", Date.now()),
    setAvatar: (id, json) => S.setAvatar.run(json, id),
    addSession: (t, uid, exp) => S.addSession.run(t, uid, exp),
    getSession: (t) => S.getSession.get(t),
    deleteSession: (t) => S.delSession.run(t || ""),
    purgeSessions: () => S.purge.run(Date.now()),
    getChannel: (id) => S.getChannel.get(id),
    listChannels: () => S.listChannels.all(),
    addChannel: (c) => S.addChannel.run(c.id, c.name, c.kind, c.shared, c.zone || "", c.orgs || "", Date.now()),
    listDmChannels: (uid) => S.dmChannels.all(`%${uid}%`).map(r => r.ch),
    addMessage: (m) => Number(S.addMessage.run(m.ch, m.uid, m.name, m.org, m.role, m.text, m.ts, m.src).lastInsertRowid),
    history: (ch, before, n) => S.history.all(ch, Number.isFinite(before) ? before : Number.MAX_SAFE_INTEGER, n).reverse(),
    search: (text, n) => S.search.all(`%${text.replace(/[%_]/g, "")}%`, n),
    openAttendance: (uid) => S.openAtt.get(uid),
    checkIn: (uid) => S.checkIn.run(uid, Date.now()),
    checkOut: (uid) => S.checkOut.run(Date.now(), uid),
    attendanceOn: (day) => { const t0 = Date.parse(day + "T00:00:00+09:00"); return S.attOn.all(t0, t0 + 864e5); },
    addInvite: (i) => S.addInvite.run(i.code, i.org, i.email || "", i.created_by, Date.now(), i.expires || 0),
    getInvite: (c) => S.getInvite.get(String(c || "")),
    useInvite: (c) => S.useInvite.run(c),
    listInvites: () => S.listInvites.all(),
  };
}
