/* ============================================================
   SAVE — localStorage, and nothing else

   The world is a pure function of the seed, so a save file is a
   position, a mission index and a handful of flags. There is no
   terrain in here.
   ============================================================ */

const KEY = 'regolith.anaxagoras.v1';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch {
    // Private mode, disabled storage, corrupt entry — all the same to us.
    return null;
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), ...data }));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
