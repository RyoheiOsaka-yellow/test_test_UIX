"""⑤ スコアリング.

parcel_score(parcel_id, period, metric, value, percentile, confidence)
指標: 通行ポテンシャル（前面リンク通行量・パーセンタイル）、滞在人口、低利用ギャップ、簡易売上試算、施策差分。
すべて推定値。API/UI は disclosure.min_value 未満を "—" にする。
"""

from __future__ import annotations

import json

import geopandas as gpd
import numpy as np
import pandas as pd

from jinryu import config


class Store:
    """processed テーブルをメモリに載せた読み取り用ストア（API から使う）."""

    def __init__(self):
        p = config.paths()
        self.p = p
        self.building = gpd.read_parquet(p.table("building"))
        self.link = gpd.read_parquet(p.table("road_link"))
        self.link_flow = (
            pd.read_parquet(p.table("link_flow"))
            if p.table("link_flow").exists()
            else pd.read_parquet(p.table("link_flow_synth")).assign(
                flow_calibrated=lambda d: d.flow_synth, confidence="low"
            )
        )
        self.building_pop = pd.read_parquet(p.table("building_pop"))
        self.mesh_flow = pd.read_parquet(p.table("mesh_flow"))
        self.origin_mix = (
            pd.read_parquet(p.table("origin_mix")) if p.table("origin_mix").exists() else pd.DataFrame()
        )
        self.count_site = gpd.read_parquet(p.table("count_site"))
        self.count_obs = pd.read_parquet(p.table("count_obs"))
        self.station = gpd.read_parquet(p.table("station"))
        self.land_price = (
            gpd.read_parquet(p.table("land_price")) if p.table("land_price").exists() else gpd.GeoDataFrame()
        )
        self.calibration = (
            json.load(open(p.processed / "calibration.json", encoding="utf-8"))
            if (p.processed / "calibration.json").exists()
            else {}
        )
        self.coef = config.coefficients()
        self.periods = sorted(self.link_flow.period.unique().tolist())
        self._flow_idx = self.link_flow.set_index(["period", "day_type", "time_band"]).sort_index()
        self._bpop_idx = self.building_pop.set_index(["period", "day_type", "time_band"]).sort_index()
        self._b_by_id = self.building.set_index("building_id")
        self._plane = config.epsg_plane()
        self._link_plane = self.link[["link_id", "geometry"]].to_crs(self._plane)
        self._bld_plane = self.building[self.building.in_bbox][["building_id", "geometry"]].to_crs(
            self._plane
        )

    # ---- 基本アクセス --------------------------------------------------
    def flows(self, period: str, day_type: str, time_band: str) -> pd.DataFrame:
        try:
            return self._flow_idx.loc[(period, day_type, time_band)].reset_index(drop=True)
        except KeyError:
            return pd.DataFrame(columns=self.link_flow.columns)

    def bpop(self, period: str, day_type: str, time_band: str) -> pd.DataFrame:
        try:
            return self._bpop_idx.loc[(period, day_type, time_band)].reset_index(drop=True)
        except KeyError:
            return pd.DataFrame(columns=self.building_pop.columns)

    def mask_small(self, v: float | None) -> float | None:
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return None if v < self.coef["disclosure"]["min_value"] else round(float(v), 1)

    # ---- 区画スコア ----------------------------------------------------
    def links_for_parcel(
        self, building_id: str | None = None, polygon=None, buffer_m: float = 25.0
    ) -> list[str]:
        """区画（建物 or 任意ポリゴン）の前面リンク集合: ポリゴンを buffer_m だけ膨らませて交差するリンク."""
        if building_id is not None:
            b = self._b_by_id.loc[building_id]
            geom = gpd.GeoSeries([b.geometry], crs=4326).to_crs(self._plane).iloc[0]
            fallback = [b.front_link_id] if isinstance(b.front_link_id, str) else []
        else:
            geom = gpd.GeoSeries([polygon], crs=4326).to_crs(self._plane).iloc[0]
            fallback = []
        g = geom.buffer(buffer_m)
        idx = list(self._link_plane.sindex.query(g, predicate="intersects"))
        ids = self._link_plane.iloc[idx].link_id.tolist()
        return ids or fallback

    def buildings_in_polygon(self, polygon) -> list[str]:
        g = gpd.GeoSeries([polygon], crs=4326).to_crs(self._plane).iloc[0]
        idx = list(self._bld_plane.sindex.query(g, predicate="intersects"))
        return self._bld_plane.iloc[idx].building_id.tolist()

    def parcel_score(
        self, period: str, building_id: str | None = None, polygon=None, sales: dict | None = None
    ) -> dict:
        link_ids = self.links_for_parcel(building_id, polygon)
        out = {
            "parcel_id": building_id or "polygon",
            "period": period,
            "links": link_ids,
            "metrics": {},
            "profile": [],
            "confidence": "low",
        }
        # 通行ポテンシャル: 前面リンクの最大通行量（時間帯・平休日別）とエリア内パーセンタイル
        prof = []
        confs = []
        for dt in ("weekday", "holiday"):
            for tb in ("day", "night", "all"):
                f = self.flows(period, dt, tb)
                sub = f[f.link_id.isin(link_ids)]
                v = float(sub.flow_calibrated.max()) if len(sub) else 0.0
                pct = float((f.flow_calibrated < v).mean() * 100) if len(f) else None
                prof.append(
                    {
                        "day_type": dt,
                        "time_band": tb,
                        "flow": self.mask_small(v),
                        "percentile": round(pct, 1) if pct is not None else None,
                    }
                )
                if len(sub):
                    confs += sub.confidence.tolist()
        out["profile"] = prof
        main = next(x for x in prof if x["day_type"] == "weekday" and x["time_band"] == "all")
        out["metrics"]["potential_weekday_all"] = main["flow"]
        out["metrics"]["potential_percentile"] = main["percentile"]
        out["metrics"]["potential_holiday_all"] = next(
            x for x in prof if x["day_type"] == "holiday" and x["time_band"] == "all"
        )["flow"]
        out["confidence"] = "high" if "high" in confs else "mid" if "mid" in confs else "low"
        # 滞在人口（建物）
        if building_id is not None:
            bp = self.bpop(period, "weekday", "day")
            v = bp[bp.building_id == building_id].pop_est
            out["metrics"]["stay_pop_weekday_day"] = self.mask_small(float(v.iloc[0])) if len(v) else None
            b = self._b_by_id.loc[building_id]
            out["building"] = {
                k: (None if pd.isna(b[k]) else (b[k].item() if hasattr(b[k], "item") else b[k]))
                for k in [
                    "usage",
                    "usage_class",
                    "floors",
                    "height",
                    "gfa",
                    "gfa_is_estimated",
                    "zoning",
                    "zoning_name",
                    "year_built",
                    "mesh_code",
                    "front_link_id",
                ]
            }
            out["metrics"]["gap_score"] = self.gap_score(period).get(building_id)
        else:
            bids = self.buildings_in_polygon(polygon)
            bp = self.bpop(period, "weekday", "day")
            out["metrics"]["stay_pop_weekday_day"] = self.mask_small(
                float(bp[bp.building_id.isin(bids)].pop_est.sum())
            )
            out["buildings_in_polygon"] = len(bids)
        # 来街者構成（市区町村レベル。データの区分に依存）
        out["origin_mix"] = self.origin_mix_for(period)
        # 簡易売上試算（係数はユーザー入力。既定は仮置き）
        s = {**self.coef["sales"], **(sales or {})}
        flow = out["metrics"]["potential_weekday_all"] or 0.0
        out["sales_estimate"] = {
            "assumptions": s,
            "monthly_customers": round(flow * s["capture_rate"] * s["business_days_per_month"]),
            "monthly_sales_yen": round(
                flow * s["capture_rate"] * s["business_days_per_month"] * s["spend_per_customer_yen"]
            ),
            "note": "ユーザー入力の仮定に基づく試算。推定通行量 × 入店率 × 営業日数 × 客単価。",
        }
        out["nearest_count_site"] = self.nearest_site(link_ids)
        return out

    def origin_mix_for(self, period: str) -> list[dict]:
        if not len(self.origin_mix):
            return []
        m = self.origin_mix[
            (self.origin_mix.period == period)
            & (self.origin_mix.day_type == "all")
            & (self.origin_mix.time_band == "day")
        ]
        m = m.groupby("origin_class").population.sum()
        tot = m.sum()
        order = ["same_city", "same_pref", "same_region", "other_region"]
        label = {
            "same_city": "市内",
            "same_pref": "県内他市町村",
            "same_region": "中国地方他県",
            "other_region": "その他地方",
        }
        return [
            {
                "origin_class": k,
                "label": label[k],
                "share": round(float(m.get(k, 0) / tot), 3) if tot else None,
            }
            for k in order
        ]

    def nearest_site(self, link_ids: list[str]) -> dict | None:
        f = self.link_flow[self.link_flow.link_id.isin(link_ids)]
        if not len(f) or "nearest_site_m" not in f.columns:
            return None
        return {"distance_m": float(f.nearest_site_m.min())}

    # ---- 低利用ギャップ（UC-R2） --------------------------------------
    def gap_table(
        self, period: str, day_type: str = "weekday", top: int = 30, usage_classes: list[str] | None = None
    ) -> pd.DataFrame:
        """通行ポテンシャル上位 × 建物滞在人口（延床あたり）下位 の建物."""
        f = self.flows(period, day_type, "all").set_index("link_id").flow_calibrated
        b = self.building[self.building.in_bbox & self.building.front_link_id.notna()].copy()
        b["front_flow"] = b.front_link_id.map(f).fillna(0)
        bp = self.bpop(period, day_type, "day").set_index("building_id").pop_est
        b["stay_pop"] = b.building_id.map(bp).fillna(0)
        b["stay_density"] = b.stay_pop / b.gfa.clip(lower=1)
        # 既定は商業・業務系（住宅は昼間滞在が低くて当然、「その他」は用途不明の附属建物が多いので除外）
        usage_classes = usage_classes or ["retail", "office", "mixed", "hotel", "public"]
        b = b[b.usage_class.isin(usage_classes)]
        b = b[b.gfa >= 50]
        b["flow_pct"] = b.front_flow.rank(pct=True) * 100
        b["density_pct"] = b.stay_density.rank(pct=True) * 100
        b["gap_score"] = (b.flow_pct - b.density_pct).round(1)
        cols = [
            "building_id",
            "usage_class",
            "zoning_name",
            "floors",
            "gfa",
            "front_link_id",
            "front_flow",
            "stay_pop",
            "flow_pct",
            "density_pct",
            "gap_score",
            "centroid_lon",
            "centroid_lat",
        ]
        return b.sort_values("gap_score", ascending=False).head(top)[cols].round(1)

    def gap_score(self, period: str) -> dict[str, float]:
        cache = getattr(self, "_gap_cache", None)
        if cache is None:
            cache = self._gap_cache = {}
        if period not in cache:
            t = self.gap_table(
                period,
                top=10**9,
                usage_classes=[
                    "retail",
                    "office",
                    "mixed",
                    "hotel",
                    "public",
                    "other",
                    "residential",
                    "industrial",
                ],
            )
            cache[period] = dict(zip(t.building_id, t.gap_score, strict=False))
        return cache[period]

    # ---- 施策差分（UC-G1） ---------------------------------------------
    def compare(
        self, period_a: str, period_b: str, day_type: str = "weekday", time_band: str = "all", polygon=None
    ) -> dict:
        a = self.flows(period_a, day_type, time_band).set_index("link_id").flow_calibrated
        b = self.flows(period_b, day_type, time_band).set_index("link_id").flow_calibrated
        d = pd.DataFrame({"a": a, "b": b}).fillna(0)
        d["diff"] = d.b - d.a
        d["ratio"] = np.where(d.a > 0, d.b / d.a, np.nan)
        target = None
        if polygon is not None:
            ids = self.links_for_parcel(polygon=polygon, buffer_m=5)
            t = d.loc[d.index.intersection(ids)]
            ring_ids = self.links_for_parcel(polygon=polygon, buffer_m=300)
            r = d.loc[d.index.intersection(ring_ids).difference(t.index)]
            target = {
                "links": len(t),
                "flow_a": round(float(t.a.sum()), 1),
                "flow_b": round(float(t.b.sum()), 1),
                "change_ratio": round(float(t.b.sum() / t.a.sum()), 3) if t.a.sum() > 0 else None,
                "surrounding_300m": {
                    "links": len(r),
                    "flow_a": round(float(r.a.sum()), 1),
                    "flow_b": round(float(r.b.sum()), 1),
                    "change_ratio": round(float(r.b.sum() / r.a.sum()), 3) if r.a.sum() > 0 else None,
                },
            }
        area_ratio = float(d.b.sum() / d.a.sum()) if d.a.sum() > 0 else None
        return {
            "period_a": period_a,
            "period_b": period_b,
            "day_type": day_type,
            "time_band": time_band,
            "area_change_ratio": round(area_ratio, 3) if area_ratio else None,
            "target": target,
            "links": d.reset_index().rename(columns={"index": "link_id"}),
        }


def build_parcel_scores(store: Store | None = None) -> pd.DataFrame:
    """全建物 × 期間の parcel_score テーブル（UI 用に前面通行量・パーセンタイル・ギャップを事前計算）."""
    s = store or Store()
    rows = []
    for period in s.periods:
        f = s.flows(period, "weekday", "all").set_index("link_id").flow_calibrated
        b = s.building[s.building.in_bbox].copy()
        b["v"] = b.front_link_id.map(f).fillna(0)
        b["pct"] = b.v.rank(pct=True) * 100
        gap = s.gap_score(period)
        for bid, v, pct in zip(b.building_id, b.v, b.pct, strict=False):
            rows.append(
                {
                    "parcel_id": bid,
                    "period": period,
                    "metric": "potential_weekday_all",
                    "value": round(float(v), 1),
                    "percentile": round(float(pct), 1),
                }
            )
            if bid in gap:
                rows.append(
                    {
                        "parcel_id": bid,
                        "period": period,
                        "metric": "gap_score",
                        "value": gap[bid],
                        "percentile": None,
                    }
                )
    df = pd.DataFrame(rows)
    df["confidence"] = "mid"
    df.to_parquet(s.p.table("parcel_score"), index=False)
    return df
