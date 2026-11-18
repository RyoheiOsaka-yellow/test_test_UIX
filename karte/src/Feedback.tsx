import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquarePlus, X } from 'lucide-react';
import { TODAY } from './data';
import { downloadCsv, useStore } from './ui';

// 社内試用で意見を集めるための仕組み。
// 意見はこのブラウザの中(localStorage)にだけ保存し、試用の担当者がCSVで回収する。

const KEY = 'aaa-demo-feedback';
const NAME_KEY = 'aaa-demo-feedback-name';
const KINDS = ['使いにくい', '分かりにくい', 'ほしい機能', '良かった点', 'その他'] as const;

interface Item {
  at: string;
  screen: string;
  path: string;
  kind: string;
  text: string;
  name: string;
}

function load(): Item[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Item[];
  } catch {
    return [];
  }
}
function save(items: Item[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function screenName(path: string): string {
  if (path === '/') return 'ダッシュボード';
  if (path === '/properties') return '物件を探す';
  if (/^\/properties\/[^/]+\/new$/.test(path)) return '指摘の登録';
  if (/^\/properties\/[^/]+\/report$/.test(path)) return 'お客様向けレポート';
  if (/^\/properties\/[^/]+$/.test(path)) return '物件詳細';
  if (path.startsWith('/karte/')) return 'AAA(説明用)';
  if (path === '/records') return '指摘・修繕データ';
  if (path === '/analytics') return 'データ分析';
  if (path === '/insights') return '修繕の課題と狙い';
  return path;
}

export function FeedbackButton() {
  const loc = useLocation();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(false);
  const [kind, setKind] = useState<string>('');
  const [text, setText] = useState('');
  const [name, setName] = useState(savedName);
  const [items, setItems] = useState<Item[]>(load);
  const [err, setErr] = useState('');

  // お客様に画面を見せている間は出さない
  if (store.present) return null;
  const screen = screenName(loc.pathname);

  const submit = () => {
    if (!kind) return setErr('種類を選んでください');
    if (!text.trim()) return setErr('内容を入力してください');
    const item: Item = { at: new Date().toISOString().slice(0, 16).replace('T', ' '), screen, path: loc.pathname, kind, text: text.trim(), name: name.trim() };
    const next = [item, ...load()];
    const ok = save(next);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* 保存できない環境では名前を覚えない */
    }
    setItems(next);
    setText('');
    setKind('');
    setErr('');
    setOpen(false);
    store.notify(ok ? 'ご意見を受け付けました。ありがとうございます' : 'このブラウザでは保存できませんでした(画面を閉じると消えます)');
  };

  return (
    <>
      <button className={`fb-fab no-print ${/\/new$/.test(loc.pathname) ? 'up' : ''}`} onClick={() => setOpen(true)} aria-label="この画面への意見を送る">
        <MessageSquarePlus size={18} />
        <span>意見を送る</span>
      </button>
      {open && (
        <div className="modal-veil no-print" onClick={() => setOpen(false)}>
          <div className="modal fb" role="dialog" aria-label="意見を送る" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{list ? `これまでの意見(${items.length}件)` : 'この画面への意見'}</h2>
              <button className="iconbtn" onClick={() => setOpen(false)} aria-label="閉じる">
                <X size={18} />
              </button>
            </header>
            {!list ? (
              <>
                <p className="fb-screen">
                  対象の画面: <b>{screen}</b>
                </p>
                <div className="fb-kinds" role="group" aria-label="種類">
                  {KINDS.map((k) => (
                    <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} aria-pressed={kind === k}>
                      {k}
                    </button>
                  ))}
                </div>
                <label className="fb-field">
                  <span>内容</span>
                  <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="例: 対応状況を変えた後、どこに反映されたか分からなかった" />
                </label>
                <label className="fb-field">
                  <span>お名前(任意)</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 青木" />
                </label>
                {err && <p className="fb-err">{err}</p>}
                <div className="fb-actions">
                  <button className="btn ghost" onClick={() => setList(true)}>
                    これまでの意見を見る({items.length}件)
                  </button>
                  <button className="btn primary" onClick={submit}>
                    送る
                  </button>
                </div>
                <p className="note">意見はこのパソコン・端末のブラウザに保存されます。試用の担当者が「これまでの意見」からCSVで回収します。</p>
              </>
            ) : (
              <>
                {items.length === 0 ? (
                  <p className="muted">まだ意見はありません。</p>
                ) : (
                  <ul className="fb-list">
                    {items.slice(0, 30).map((it, i) => (
                      <li key={i}>
                        <small>
                          {it.at} ／ {it.screen} ／ {it.kind}
                          {it.name && ` ／ ${it.name}`}
                        </small>
                        <span>{it.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="fb-actions">
                  <button className="btn ghost" onClick={() => setList(false)}>
                    意見を書く
                  </button>
                  <button
                    className="btn primary"
                    disabled={items.length === 0}
                    onClick={() =>
                      downloadCsv(
                        `AAA_feedback_${TODAY}.csv`,
                        ['日時', '画面', '種類', '内容', 'お名前', 'URL'],
                        items.map((it) => [it.at, it.screen, it.kind, it.text, it.name, it.path]),
                      )
                    }
                  >
                    CSVで書き出す
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
