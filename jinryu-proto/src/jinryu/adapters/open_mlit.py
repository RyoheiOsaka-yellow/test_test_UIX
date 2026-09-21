"""国交省「全国の人流オープンデータ」アダプタ.

data/raw/mlit_flow/ に置かれた zip（attribute.zip, monthly_mdp_mesh1km_<pref>.zip, monthly_fromto_city_<pref>.zip）
を展開せずに読み、mesh_flow スキーマへ正規化する。
"""

from __future__ import annotations

import io
import zipfile

import pandas as pd

from jinryu import config
from jinryu.adapters.base import MESH_FLOW_COLUMNS, validate_mesh_flow
from jinryu.config import DAYFLAG_MAP, FROM_AREA_MAP, TIMEZONE_MAP


class OpenMlitFlow:
    name = "open_mlit"

    def __init__(self, raw_dir=None, pref_code: str | None = None):
        self.raw_dir = raw_dir or config.paths().raw / "mlit_flow"
        self.pref = pref_code or config.area()["area"]["pref_code"]

    # --- 内部 -----------------------------------------------------------
    def _zip(self, kind: str) -> zipfile.ZipFile:
        path = self.raw_dir / f"{kind}_{self.pref}.zip"
        if not path.exists():
            raise FileNotFoundError(f"{path} がありません。`jinryu fetch` を実行してください")
        return zipfile.ZipFile(path)

    @staticmethod
    def _read_nested_csv(outer: zipfile.ZipFile, member: str) -> pd.DataFrame:
        with outer.open(member) as f:
            inner = zipfile.ZipFile(io.BytesIO(f.read()))
            csv_name = [n for n in inner.namelist() if n.endswith(".csv")][0]
            with inner.open(csv_name) as c:
                return pd.read_csv(c, dtype=str)

    def _member(self, outer: zipfile.ZipFile, period: str, fname: str) -> str:
        y, m = period.split("-")
        cands = [n for n in outer.namelist() if n.endswith(f"{y}/{m}/{fname}.csv.zip")]
        if not cands:
            raise KeyError(f"{period} のデータが zip 内にありません")
        return cands[0]

    # --- 公開 IF ----------------------------------------------------------
    def available_periods(self) -> list[str]:
        z = self._zip("monthly_mdp_mesh1km")
        out = set()
        for n in z.namelist():
            if n.endswith("monthly_mdp_mesh1km.csv.zip"):
                parts = n.split("/")
                out.add(f"{parts[-3]}-{parts[-2]}")
        return sorted(out)

    def attributes(self) -> pd.DataFrame:
        """1km メッシュ属性（中心・範囲座標）."""
        if getattr(self, "_attr", None) is not None:
            return self._attr
        z = zipfile.ZipFile(self.raw_dir / "attribute.zip")
        member = [n for n in z.namelist() if n.endswith("2020.csv.zip")][0]
        df = self._read_nested_csv(z, member)
        for c in ["lon_center", "lat_center", "lon_max", "lat_max", "lon_min", "lat_min"]:
            df[c] = df[c].astype(float)
        self._attr = df.rename(columns={"mesh1kmid": "mesh_code"})
        return self._attr

    def load(self, bbox, period: str) -> pd.DataFrame:
        lon0, lat0, lon1, lat1 = bbox
        attr = self.attributes()
        # bbox と重なるメッシュ（メッシュ矩形と bbox の交差）
        attr = attr[
            (attr.lon_max > lon0) & (attr.lon_min < lon1) & (attr.lat_max > lat0) & (attr.lat_min < lat1)
        ]
        z = self._zip("monthly_mdp_mesh1km")
        df = self._read_nested_csv(z, self._member(z, period, "monthly_mdp_mesh1km"))
        df = df.rename(columns={"mesh1kmid": "mesh_code"})
        df = df[df.mesh_code.isin(set(attr.mesh_code))].copy()
        df["period"] = period
        df["day_type"] = df.dayflag.map(DAYFLAG_MAP)
        df["time_band"] = df.timezone.map(TIMEZONE_MAP)
        df["population"] = df.population.astype(float)
        df["origin_class"] = "total"
        df["source"] = self.name
        return validate_mesh_flow(df)[MESH_FLOW_COLUMNS].reset_index(drop=True)

    def load_origin_mix(self, city_codes: list[str], period: str) -> pd.DataFrame:
        z = self._zip("monthly_fromto_city")
        df = self._read_nested_csv(z, self._member(z, period, "monthly_fromto_city"))
        df = df[df.citycode.isin(city_codes)].copy()
        df["period"] = period
        df["day_type"] = df.dayflag.map(DAYFLAG_MAP)
        df["time_band"] = df.timezone.map(TIMEZONE_MAP)
        df["origin_class"] = df.from_area.map(FROM_AREA_MAP)
        df["population"] = df.population.astype(float)
        df["source"] = self.name
        return df[
            ["citycode", "period", "day_type", "time_band", "origin_class", "population", "source"]
        ].rename(columns={"citycode": "city_code"})
