import { useEffect, useMemo, useRef, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChartColumn, ClipboardList, LayoutDashboard, Lightbulb, Presentation, Search } from 'lucide-react';
import { checks, matches, properties, propertyById, repairs } from './data';
import { CheckBadge, SeverityBadge, StoreProvider, useStore } from './ui';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Records from './pages/Records';
import Insights from './pages/Insights';
import Analytics from './pages/Analytics';
import Report from './pages/Report';
import MyPage from './pages/MyPage';
import NewFinding from './pages/NewFinding';
import { FeedbackButton } from './Feedback';

function GlobalSearch() {
  const { findings } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    setQ('');
  }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const res = useMemo(() => {
    if (!q.trim()) return null;
    const ps = properties.filter((p) => matches(q, p.name, p.address, p.owner, p.ownerKana, p.id, p.staff));
    const fs = findings.filter((f) => f.severity !== 'ok' && matches(q, f.title, f.part, f.location, f.id, f.description));
    const rs = repairs.filter((r) => matches(q, r.work, r.place, r.part, r.contractor, r.id));
    const cs = checks.filter((c) => matches(q, c.kind, c.round, c.result, c.summary, c.by, c.id, ...(c.items ?? []).map((i) => i.area + i.judge)));
    return { ps, fs, rs, cs };
  }, [q, findings]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="gsearch">
      <Search size={16} />
      <input
        ref={ref}
        value={q}
        placeholder="物件名・オーナー名・住所・指摘内容・工事内容で検索( / )"
        aria-label="全体検索"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) go(`/properties?q=${encodeURIComponent(q.trim())}`);
        }}
      />
      {open && res && (
        <>
          <div className="gsearch-veil" onClick={() => setOpen(false)} />
          <div className="gsearch-pop">
            {res.ps.length + res.fs.length + res.rs.length + res.cs.length === 0 && (
              <div className="gs-none">「{q}」に一致するデータはありません</div>
            )}
            {res.ps.length > 0 && (
              <section>
                <h4>
                  物件・オーナー <span>{res.ps.length}件</span>
                </h4>
                {res.ps.slice(0, 6).map((p) => (
                  <button key={p.id} onClick={() => go(`/properties/${p.id}`)}>
                    <b>{p.name}</b>
                    <small>
                      {p.address} ／ {p.owner} 様 ／ 総合 {p.overall.toFixed(1)}
                    </small>
                  </button>
                ))}
                {res.ps.length > 6 && (
                  <button className="more" onClick={() => go(`/properties?q=${encodeURIComponent(q.trim())}`)}>
                    すべての物件結果を見る
                  </button>
                )}
              </section>
            )}
            {res.fs.length > 0 && (
              <section>
                <h4>
                  指摘事項 <span>{res.fs.length}件</span>
                </h4>
                {res.fs.slice(0, 5).map((f) => (
                  <button key={f.id} onClick={() => go(`/properties/${f.propertyId}?f=${f.id}`)}>
                    <b>
                      <SeverityBadge severity={f.severity} short /> {f.part}|{f.location} {f.title}
                    </b>
                    <small>{propertyById.get(f.propertyId)!.name}</small>
                  </button>
                ))}
                {res.fs.length > 5 && (
                  <button className="more" onClick={() => go(`/records?tab=findings&q=${encodeURIComponent(q.trim())}`)}>
                    すべての指摘結果を見る
                  </button>
                )}
              </section>
            )}
            {res.rs.length > 0 && (
              <section>
                <h4>
                  修繕履歴 <span>{res.rs.length}件</span>
                </h4>
                {res.rs.slice(0, 4).map((r) => (
                  <button key={r.id} onClick={() => go(`/properties/${r.propertyId}`)}>
                    <b>
                      {r.place} {r.work}
                    </b>
                    <small>
                      {propertyById.get(r.propertyId)!.name} ／ {r.date.replaceAll('-', '/')} ／ {r.cost.toLocaleString()}円
                    </small>
                  </button>
                ))}
                {res.rs.length > 4 && (
                  <button className="more" onClick={() => go(`/records?tab=repairs&q=${encodeURIComponent(q.trim())}`)}>
                    すべての修繕結果を見る
                  </button>
                )}
              </section>
            )}
            {res.cs.length > 0 && (
              <section>
                <h4>
                  点検・審査 <span>{res.cs.length}件</span>
                </h4>
                {res.cs.slice(0, 4).map((c) => (
                  <button key={c.id} onClick={() => go(`/properties/${c.propertyId}`)}>
                    <b>
                      <CheckBadge kind={c.kind} short /> {c.round} {c.result}
                    </b>
                    <small>
                      {propertyById.get(c.propertyId)!.name} ／ {c.date.replaceAll('-', '/')} ／ {c.summary}
                    </small>
                  </button>
                ))}
                {res.cs.length > 4 && (
                  <button className="more" onClick={() => go(`/records?tab=inspections&q=${encodeURIComponent(q.trim())}`)}>
                    すべての点検・審査結果を見る
                  </button>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Shell() {
  const store = useStore();
  const [params] = useSearchParams();
  const ownerView = params.get('view') === 'owner';
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const routes = (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/properties" element={<Properties />} />
      <Route path="/properties/:id" element={<PropertyDetail />} />
      <Route path="/properties/:id/report" element={<Report />} />
      <Route path="/karte/:id" element={<MyPage />} />
      <Route path="/properties/:id/new" element={<NewFinding />} />
      <Route path="/records" element={<Records />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/insights" element={<Insights />} />
    </Routes>
  );

  if (loc.pathname.endsWith('/report') || loc.pathname.startsWith('/karte/'))
    return (
      <>
        {routes}
        <FeedbackButton />
      </>
    );
  if (ownerView) return <div className="owner-shell">{routes}</div>;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <Building2 size={20} />
          <div>
            <b>AAA</b>
            <small>修繕データ一元管理</small>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            <LayoutDashboard size={17} /> ダッシュボード
          </NavLink>
          <NavLink to="/properties">
            <Building2 size={17} /> 物件を探す
          </NavLink>
          <NavLink to="/records">
            <ClipboardList size={17} /> 指摘・修繕データ
          </NavLink>
          <NavLink to={`/karte/${loc.pathname.match(/^\/properties\/(P-\d+)/)?.[1] ?? 'P-0001'}`}>
            <Presentation size={17} /> AAA(説明用)
          </NavLink>
          <NavLink to="/analytics">
            <ChartColumn size={17} /> データ分析
          </NavLink>
          <NavLink to="/insights">
            <Lightbulb size={17} /> 修繕の課題と狙い
          </NavLink>
        </nav>
        <div className="side-note">
          <p>デモ用データ(架空の物件・人物)を表示しています。</p>
          <button
            className="side-reset"
            onClick={() => {
              if (window.confirm('対応状況の変更や登録した指摘など、デモで操作した内容をすべて元に戻します。よろしいですか？')) store.reset();
            }}
          >
            デモを初期状態に戻す
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <GlobalSearch />
          <div className="me">
            <span className="avatar">青</span>
            青木 涼<small>東京西支店</small>
          </div>
        </header>
        <main className="content">{routes}</main>
        <FeedbackButton />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
