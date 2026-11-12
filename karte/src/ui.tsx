import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  TODAY,
  activities as baseActivities,
  findings as baseFindings,
  propertyById,
  type Activity,
  type Finding,
  type FindingStatus,
  type Part,
  type Severity,
  SEVERITY_LABEL,
} from './data';

// ---------- store(ステータス変更などの操作をセッション内で保持) ----------

interface Store {
  findings: Finding[];
  activities: Activity[];
  setStatus: (id: string, status: FindingStatus) => void;
}
const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, FindingStatus>>({});
  const [extra, setExtra] = useState<Activity[]>([]);

  const value = useMemo<Store>(() => {
    const findings = baseFindings.map((f) =>
      overrides[f.id] ? { ...f, status: overrides[f.id], statusDate: TODAY } : f,
    );
    return {
      findings,
      activities: [...extra, ...baseActivities],
      setStatus: (id, status) => {
        const f = baseFindings.find((x) => x.id === id);
        if (!f) return;
        const p = propertyById.get(f.propertyId)!;
        setOverrides((o) => ({ ...o, [id]: status }));
        setExtra((e) => [
          {
            id: `A-new-${e.length + 1}`,
            propertyId: f.propertyId,
            date: TODAY,
            type: status === '提案済' ? '提案' : status === '承認済' ? '承認' : status === '見積中' ? '見積' : '工事',
            actor: p.staff,
            text: `${f.part}|${f.location}(${f.id})のステータスを「${status}」に更新`,
            ownerVisible: status !== '見積中' && status !== '未対応',
          },
          ...e,
        ]);
      },
    };
  }, [overrides, extra]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('StoreProvider is missing');
  return s;
}

// ---------- small components ----------

export function SeverityBadge({ severity, short }: { severity: Severity; short?: boolean }) {
  const text = short ? { urgent: '早急', watch: '経過観察', ok: '問題なし' }[severity] : SEVERITY_LABEL[severity];
  return (
    <span className={`badge sev-${severity}`}>
      <i className="dot" />
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status: FindingStatus }) {
  return <span className={`badge st st-${status}`}>{status}</span>;
}

export function ScoreBar({ score }: { score: number }) {
  const tone = score >= 7 ? 'good' : score >= 6 ? 'mid' : 'bad';
  return (
    <span className="scorebar">
      <b className="num">{score.toFixed(1)}</b>
      <span className="track">
        <span className={`fill ${tone}`} style={{ width: `${score * 10}%` }} />
      </span>
    </span>
  );
}

export function Stars({ score }: { score: number }) {
  const n = Math.round(score / 2);
  return (
    <span className="stars" aria-label={`5段階中${n}`}>
      {'★'.repeat(n)}
      <span className="off">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

const PHOTO_TONE: Record<Part, [string, string]> = {
  外壁: ['#c9c4bb', '#a9a299'],
  屋根: ['#7f8a96', '#5d6874'],
  防水: ['#9fb0a6', '#7d8f85'],
  構造: ['#b7b2ad', '#8f8a85'],
  設備: ['#a8b3c2', '#8693a3'],
};

/** 実写真の代わりに表示するダミー画像(部位ごとに色味と劣化表現を変える) */
export function Photo({ part, seed, after, label }: { part: Part; seed: number; after?: boolean; label?: string }) {
  const [a, b] = PHOTO_TONE[part];
  const s = (seed * 37) % 60;
  return (
    <svg className="photo" viewBox="0 0 120 90" role="img" aria-label={label ?? `${part}の写真(サンプル)`}>
      <defs>
        <linearGradient id={`g${part}${seed}${after ? 'a' : 'b'}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={after ? '#e6e9ee' : a} />
          <stop offset="1" stopColor={after ? '#cfd5dd' : b} />
        </linearGradient>
      </defs>
      <rect width="120" height="90" fill={`url(#g${part}${seed}${after ? 'a' : 'b'})`} />
      {[18, 36, 54, 72].map((y) => (
        <line key={y} x1="0" x2="120" y1={y} y2={y} stroke="#00000014" strokeWidth="1" />
      ))}
      {!after && (
        <path
          d={`M${20 + s} 6 l-6 14 l9 9 l-7 16 l10 10 l-5 18`}
          fill="none"
          stroke="#3b3632"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.75"
        />
      )}
      {!after && <ellipse cx={86 - s / 2} cy={62} rx="14" ry="8" fill="#00000018" />}
      <text x="6" y="84" fontSize="7" fill="#ffffffcc">
        {label ?? 'サンプル画像'}
      </text>
    </svg>
  );
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const body = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
