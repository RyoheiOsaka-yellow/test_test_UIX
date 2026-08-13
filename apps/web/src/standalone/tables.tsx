/**
 * Engineering tables — the deliverables a naval architect actually reads:
 * a hydrostatic table swept over draft, and the loading condition with its
 * weight/centre bookkeeping.
 */

import { useMemo } from 'react';
import {
  computeHydrostatics,
  tankState,
  type HydroResult,
  type TankEntityData,
  type WeightItem,
} from '@dock/shared';
import type { Model } from './store.js';
import { fmt } from './charts.js';

export function HydroTable(props: { model: Model; highlightDraft: number }) {
  const { model } = props;
  const rows = useMemo(() => {
    const out: HydroResult[] = [];
    const depth = model.vessel.principal.depth;
    for (let t = 1; t <= depth + 1e-9; t += 0.5) {
      try {
        out.push(
          computeHydrostatics(
            model.hull.geometry,
            { draft: t, rhoWater: model.vessel.rhoWater, kg: model.vessel.kg },
            { lpp: model.vessel.principal.lpp, beam: model.vessel.principal.beam },
          ),
        );
      } catch {
        /* below first waterline */
      }
    }
    return out;
  }, [model]);

  return (
    <section className="card table-card">
      <h2>流体静力学表 — 海水 ρ = {model.vessel.rhoWater} t/m³</h2>
      <div className="table-scroll">
        <table className="eng">
          <thead>
            <tr>
              <th>喫水<br /><span>m</span></th>
              <th>排水量 Δ<br /><span>t</span></th>
              <th>LCB<br /><span>m</span></th>
              <th>KB<br /><span>m</span></th>
              <th>KMt<br /><span>m</span></th>
              <th>TPC<br /><span>t/cm</span></th>
              <th>MCT1cm<br /><span>t·m</span></th>
              <th>Cb<br /><span>—</span></th>
              <th>Cw<br /><span>—</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.condition.draft}
                className={
                  Math.abs(r.condition.draft - props.highlightDraft) < 0.26 ? 'now' : ''
                }
              >
                <td>{fmt(r.condition.draft, 2)}</td>
                <td>{fmt(r.displacement, 0)}</td>
                <td>{fmt(r.lcb, 2)}</td>
                <td>{fmt(r.kb, 3)}</td>
                <td>{fmt(r.kmt, 3)}</td>
                <td>{fmt(r.tpc, 2)}</td>
                <td>{fmt(r.mct1cm, 1)}</td>
                <td>{fmt(r.cb, 3)}</td>
                <td>{fmt(r.cw, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">行の強調は現在の喫水スライダー位置。</p>
    </section>
  );
}

interface LoadingRow {
  id: string;
  name: string;
  mass: number;
  lcg: number;
  tcg: number;
  vcg: number;
  fsm: number;
}

export function LoadingTable(props: { model: Model; cargo: WeightItem[] }) {
  const { model } = props;
  const rows = useMemo((): LoadingRow[] => {
    const ls = model.vessel.lightship!;
    const out: LoadingRow[] = [
      {
        id: 'lightship',
        name: '軽荷重量',
        mass: ls.mass,
        lcg: ls.lcg,
        tcg: ls.tcg ?? 0,
        vcg: ls.vcg,
        fsm: 0,
      },
    ];
    for (const t of model.tanks) {
      const s = tankState(t.data);
      if (s.fluidMass <= 0) {
        out.push({
          id: t.id, name: t.data.name, mass: 0,
          lcg: (t.data.x0 + t.data.x1) / 2, tcg: (t.data.y0 + t.data.y1) / 2, vcg: t.data.z0,
          fsm: 0,
        });
        continue;
      }
      const fillH = (t.data.z1 - t.data.z0) * (t.data.fillPercent / 100);
      out.push({
        id: t.id,
        name: t.data.name,
        mass: s.fluidMass,
        lcg: (t.data.x0 + t.data.x1) / 2,
        tcg: (t.data.y0 + t.data.y1) / 2,
        vcg: t.data.z0 + fillH / 2,
        fsm: s.freeSurfaceMoment,
      });
    }
    for (const w of props.cargo) {
      out.push({
        id: w.id,
        name: w.name ?? w.id,
        mass: w.mass,
        lcg: w.x,
        tcg: w.y,
        vcg: w.z,
        fsm: 0,
      });
    }
    return out;
  }, [model, props.cargo]);

  const total = useMemo(() => {
    let m = 0, mx = 0, my = 0, mz = 0, fsm = 0;
    for (const r of rows) {
      m += r.mass;
      mx += r.mass * r.lcg;
      my += r.mass * r.tcg;
      mz += r.mass * r.vcg;
      fsm += r.fsm;
    }
    return {
      mass: m,
      lcg: m > 0 ? mx / m : 0,
      tcg: m > 0 ? my / m : 0,
      vcg: m > 0 ? mz / m : 0,
      fsm,
      fsc: m > 0 ? fsm / m : 0,
    };
  }, [rows]);

  return (
    <section className="card table-card">
      <h2>積付条件 — 重量・重心・自由表面</h2>
      <div className="table-scroll">
        <table className="eng">
          <thead>
            <tr>
              <th className="txt">項目</th>
              <th>重量<br /><span>t</span></th>
              <th>LCG<br /><span>m</span></th>
              <th>TCG<br /><span>m</span></th>
              <th>VCG<br /><span>m</span></th>
              <th>FSM<br /><span>t·m</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.mass <= 0 ? 'empty' : ''}>
                <td className="txt">
                  {r.id.startsWith('tank:') && (
                    <span className="tank-id">{r.id.replace(/^tank:/, '')} </span>
                  )}
                  {r.name}
                </td>
                <td>{fmt(r.mass, 1)}</td>
                <td>{fmt(r.lcg, 2)}</td>
                <td>{fmt(r.tcg, 2)}</td>
                <td>{fmt(r.vcg, 2)}</td>
                <td>{r.fsm > 0 ? fmt(r.fsm, 1) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="txt">合計 / 換算</td>
              <td>{fmt(total.mass, 1)}</td>
              <td>{fmt(total.lcg, 2)}</td>
              <td>{fmt(total.tcg, 2)}</td>
              <td>{fmt(total.vcg, 2)}</td>
              <td>{fmt(total.fsm, 1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted">
        自由表面修正 FSC = ΣFSM / W ={' '}
        <span className="num">{fmt(total.fsc, 3)}</span> m(小傾斜近似)。
        L1 の釣合解は各タンクの実液面移動を用いるため、FSC はこの表の参考値です。
      </p>
    </section>
  );
}
