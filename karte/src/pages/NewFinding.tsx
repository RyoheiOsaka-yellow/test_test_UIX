import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, MapPin, Trash2 } from 'lucide-react';
import {
  PARTS,
  SEVERITY_LABEL,
  TEMPLATES,
  TODAY,
  addMonths,
  checksOf,
  fmtDate,
  propertyById,
  type Finding,
  type Part,
  type Severity,
} from '../data';
import { CheckBadge, Empty, useStore } from '../ui';
import { Shot, kindOf } from '../Shot';

// 指摘の登録(現地でiPadから入力する想定)。
// デモでは登録内容はブラウザの中だけに保持し、再読み込みで消える。

const SEV_HELP: Record<Severity, string> = {
  urgent: '放置すると被害が広がる。1年程度以内の修繕を推奨',
  watch: '今すぐではないが、次回点検までに変化を確認',
  ok: '確認した結果、問題なし(記録として残す)',
};
const SEV_DUE: Record<Severity, number | null> = { urgent: 12, watch: 36, ok: null };
const PIN = { urgent: '#d92d20', watch: '#f5a524', ok: '#12925a' } as const;

let seq = 0;

export default function NewFinding() {
  const { id } = useParams();
  const p = propertyById.get(id ?? '');
  const store = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [part, setPart] = useState<Part | null>(null);
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [cost, setCost] = useState('');
  const [source, setSource] = useState('');
  const [photos, setPhotos] = useState<{ url: string; sample?: number }[]>([]);
  const [tried, setTried] = useState(false);

  const existing = useMemo(() => store.findings.filter((f) => f.propertyId === id && f.status !== '完了'), [store.findings, id]);
  const sources = useMemo(() => (p ? checksOf(p.id).slice(0, 4) : []), [p]);

  if (!p) return <Empty>物件が見つかりません。</Empty>;

  const missing = {
    pin: !pin,
    part: !part,
    location: !location.trim(),
    severity: !severity,
    title: !title.trim(),
  };
  const ok = !Object.values(missing).some(Boolean);
  const pk = p.site.parking;

  const placePin = (e: MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return;
    const q = pt.matrixTransform(m.inverse());
    setPin({ x: Math.round(Math.max(44, Math.min(356, q.x))), y: Math.round(Math.max(30, Math.min(246, q.y))) });
  };

  const chooseSeverity = (s: Severity) => {
    setSeverity(s);
    const months = SEV_DUE[s];
    if (!due || due === addMonths(TODAY, 12).slice(0, 7) || due === addMonths(TODAY, 36).slice(0, 7)) {
      setDue(months ? addMonths(TODAY, months).slice(0, 7) : '');
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const urls = [...files].slice(0, 10 - photos.length).map((f) => ({ url: URL.createObjectURL(f) }));
    setPhotos((ph) => [...ph, ...urls]);
  };

  const save = () => {
    setTried(true);
    if (!ok || !part || !severity || !pin) {
      store.notify('未入力の項目があります。赤い印の項目を確認してください');
      return;
    }
    const f: Finding = {
      id: `F-N${String(++seq).padStart(3, '0')}`,
      propertyId: p.id,
      part,
      location: location.trim(),
      severity,
      title: title.trim(),
      description: desc.trim() || '(現地で登録。詳細は追って記入)',
      foundDate: TODAY,
      dueBy: severity === 'ok' ? null : due || null,
      estCost: Math.round(Number(cost || 0) * 10000),
      status: severity === 'ok' ? '完了' : '未対応',
      statusDate: TODAY,
      pin,
      photos: Math.max(photos.length, 1),
      memo: source ? `発見元: ${source}` : '',
      photoUrls: photos.some((x) => x.sample === undefined) ? photos.map((x) => (x.sample === undefined ? x.url : '')) : undefined,
    };
    store.addFinding(f);
    store.notify(`指摘「${f.part}|${f.location}」を登録しました`);
    navigate(`/properties/${p.id}?f=${f.id}`);
  };

  const req = (k: keyof typeof missing) => (tried && missing[k] ? 'nf-field invalid' : 'nf-field');

  return (
    <>
      <nav className="crumb no-print">
        <Link to={`/properties/${p.id}`}>
          <ArrowLeft size={14} /> {p.name}
        </Link>
      </nav>
      <div className="page-head">
        <div>
          <h1>指摘を登録</h1>
          <p className="sub">
            {p.name} ／ 現地で見つけた不具合・劣化を記録します。<b>*</b> は必須です。
          </p>
        </div>
      </div>

      <div className="nf">
        <section className={`card ${req('pin')}`}>
          <header>
            <h2>
              <i className="no">1</i>場所 <b className="req">*</b>
            </h2>
            <span className="hint">配置図を押して位置を指定</span>
          </header>
          <svg viewBox="0 0 400 290" className="siteplan nf-map" onClick={placePin} role="img" aria-label="配置図。押した位置に指摘を置きます">
            <rect width="400" height="290" fill="#eef1f5" />
            <rect x="0" y="252" width="400" height="38" fill="#d5dae2" />
            <rect x="40" y="24" width="320" height="226" rx="4" fill="#e2ecd9" stroke="#c3cfb8" />
            <rect x={pk.x} y={pk.y} width={pk.w} height={pk.h} fill="#dfe3ea" stroke="#c5ccd8" />
            <text x={pk.x + pk.w / 2} y={pk.y + pk.h / 2 + 4} textAnchor="middle" fontSize="10" fill="#7a8494">
              {pk.label}
            </text>
            {p.site.buildings.map((b) => (
              <g key={b.label}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fbfcfd" stroke="#9aa5b6" strokeWidth="1.5" />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize="11" fill="#7a8494">
                  {b.label}
                </text>
              </g>
            ))}
            {existing.map((f) => (
              <circle key={f.id} cx={f.pin.x} cy={f.pin.y - 8} r="6" fill={PIN[f.severity]} opacity="0.35" />
            ))}
            {pin && (
              <g transform={`translate(${pin.x},${pin.y})`}>
                <circle r="20" fill="#2a62d6" opacity="0.15" />
                <path d="M0 0 C-12 -15 -12 -30 0 -30 C12 -30 12 -15 0 0 Z" fill={severity ? PIN[severity] : '#2a62d6'} stroke="#fff" strokeWidth="2" />
                <circle cy="-19" r="4.5" fill="#fff" />
              </g>
            )}
          </svg>
          <p className="nf-hint">
            <MapPin size={14} /> {pin ? '位置を指定しました。押し直すと移動できます。' : '薄い丸は登録済みの指摘です。'}
          </p>
        </section>

        <section className="card">
          <header>
            <h2>
              <i className="no">2</i>内容
            </h2>
          </header>
          <div className={req('part')}>
            <span className="nf-label">
              部位 <b className="req">*</b>
            </span>
            <div className="nf-choices">
              {PARTS.map((x) => (
                <button key={x} className={part === x ? 'on' : ''} aria-pressed={part === x} onClick={() => setPart(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
          <label className={req('location')}>
            <span className="nf-label">
              箇所 <b className="req">*</b>
            </span>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例: 北側、2Fバルコニー" />
          </label>
          {part && (
            <div className="nf-suggest">
              {TEMPLATES[part].locations.map((x) => (
                <button key={x} onClick={() => setLocation(x)}>
                  {x}
                </button>
              ))}
            </div>
          )}
          <div className={req('severity')}>
            <span className="nf-label">
              緊急度 <b className="req">*</b>
            </span>
            <div className="nf-sev">
              {(['urgent', 'watch', 'ok'] as Severity[]).map((s) => (
                <button key={s} className={`sev-${s} ${severity === s ? 'on' : ''}`} aria-pressed={severity === s} onClick={() => chooseSeverity(s)}>
                  <b>{SEVERITY_LABEL[s]}</b>
                  <small>{SEV_HELP[s]}</small>
                </button>
              ))}
            </div>
          </div>
          <label className={req('title')}>
            <span className="nf-label">
              件名 <b className="req">*</b>
            </span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 外壁のひび割れ・塗膜の劣化" />
          </label>
          {part && (
            <div className="nf-suggest">
              {TEMPLATES[part].titles.map((x) => (
                <button key={x} onClick={() => setTitle(x)}>
                  {x}
                </button>
              ))}
            </div>
          )}
          <label className="nf-field">
            <span className="nf-label">詳しい状況</span>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例: 幅0.5mm程度のひび割れが2m程度。雨染みあり。" />
          </label>
        </section>

        <section className="card">
          <header>
            <h2>
              <i className="no">3</i>写真
            </h2>
            <span className="hint">全景 → 中景 → 近景の順に撮ると伝わりやすい(最大10枚)</span>
          </header>
          <div className="nf-photos">
            {photos.map((ph, i) => (
              <figure key={ph.url}>
                {ph.sample !== undefined && part ? (
                  <Shot part={part} kind={kindOf(i)} index={i} seed={pin?.x ?? 100} />
                ) : (
                  <img src={ph.url} alt={`写真${i + 1}`} />
                )}
                <figcaption>{kindOf(i)}</figcaption>
                <button className="nf-del" onClick={() => setPhotos(photos.filter((_, k) => k !== i))} aria-label={`写真${i + 1}を削除`}>
                  <Trash2 size={14} />
                </button>
              </figure>
            ))}
            {photos.length < 10 && (
              <button className="nf-add" onClick={() => fileRef.current?.click()}>
                <Camera size={22} />
                撮影・写真を選ぶ
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button
            className="btn ghost nf-sample"
            disabled={!part || photos.length >= 10}
            onClick={() => setPhotos((ph) => [...ph, { url: `sample-${Date.now()}`, sample: ph.length }])}
            title={!part ? '先に部位を選んでください' : undefined}
          >
            <ImagePlus size={15} /> デモ用のサンプル写真を追加
          </button>
        </section>

        <section className="card">
          <header>
            <h2>
              <i className="no">4</i>修繕の目安
            </h2>
            <span className="hint">分かる範囲で。あとから物件詳細で更新できます</span>
          </header>
          <div className="nf-two">
            <label className="nf-field">
              <span className="nf-label">推奨修繕時期(この月まで)</span>
              <input type="month" value={due} disabled={severity === 'ok'} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="nf-field">
              <span className="nf-label">概算費用(万円)</span>
              <input type="number" inputMode="numeric" min="0" value={cost} disabled={severity === 'ok'} onChange={(e) => setCost(e.target.value)} placeholder="例: 120" />
            </label>
          </div>
          <div className="nf-field">
            <span className="nf-label">発見した点検・審査</span>
            <div className="nf-choices wrap">
              {sources.map((c) => {
                const label = `${fmtDate(c.date)} ${c.round}`;
                return (
                  <button key={c.id} className={source === label ? 'on' : ''} onClick={() => setSource(source === label ? '' : label)}>
                    <CheckBadge kind={c.kind} short /> {label}
                  </button>
                );
              })}
              <button className={source === '本日の現地確認' ? 'on' : ''} onClick={() => setSource(source === '本日の現地確認' ? '' : '本日の現地確認')}>
                本日の現地確認
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="nf-bar">
        <span>
          {ok ? (
            '入力が完了しました'
          ) : (
            <>
              未入力:{' '}
              {[missing.pin && '場所', missing.part && '部位', missing.location && '箇所', missing.severity && '緊急度', missing.title && '件名'].filter(Boolean).join('・')}
            </>
          )}
        </span>
        <div>
          <Link className="btn" to={`/properties/${p.id}`}>
            やめる
          </Link>
          <button className="btn primary" onClick={save}>
            登録する
          </button>
        </div>
      </div>
    </>
  );
}
