"""設定ファイル (config/*.yaml) とパスの一元管理."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(os.environ.get("JINRYU_ROOT", Path(__file__).resolve().parents[2]))
CONFIG_DIR = ROOT / "config"


def _data_dir() -> Path:
    d = os.environ.get("JINRYU_DATA_DIR")
    return (ROOT / d).resolve() if d and not os.path.isabs(d) else Path(d) if d else ROOT / "data"


@dataclass
class Paths:
    root: Path = ROOT
    config: Path = CONFIG_DIR
    data: Path = field(default_factory=_data_dir)

    @property
    def raw(self) -> Path:
        return self.data / "raw"

    @property
    def interim(self) -> Path:
        return self.data / "interim"

    @property
    def processed(self) -> Path:
        # デモバンドル (JINRYU_DATA_DIR=data/demo) では processed 階層を持たない
        return self.data if (self.data / "building.parquet").exists() else self.data / "processed"

    @property
    def docs(self) -> Path:
        return self.root / "docs"

    def table(self, name: str) -> Path:
        return self.processed / f"{name}.parquet"


def write_table(df, path: Path, **kw) -> Path:
    """parquet を原子的に書く（同じ名前の一時ファイルに書いてから置き換える）.

    直接上書きすると、書いている最中に読んだプロセスが壊れたデータを掴む。
    calibrate の直後に実験を起動して、同じ条件なのに違う結果が出たことがあった。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    df.to_parquet(tmp, **kw)
    tmp.replace(path)
    return path


def _load_yaml(name: str) -> dict[str, Any]:
    with open(CONFIG_DIR / name, encoding="utf-8") as f:
        return yaml.safe_load(f)


def area_file() -> str:
    """JINRYU_AREA=fukuoka → config/area_fukuoka.yaml。未指定は config/area.yaml（岡山）."""
    a = os.environ.get("JINRYU_AREA", "").strip()
    return f"area_{a}.yaml" if a and a != "okayama" else "area.yaml"


@cache
def area() -> dict[str, Any]:
    return _load_yaml(area_file())


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = _deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


@cache
def coefficients() -> dict[str, Any]:
    """config/coefficients.yaml に、エリア別の上書き（coefficients_<area>.yaml）を重ねて返す."""
    base = _load_yaml("coefficients.yaml")
    a = os.environ.get("JINRYU_AREA", "").strip()
    if a and a != "okayama" and (CONFIG_DIR / f"coefficients_{a}.yaml").exists():
        base = _deep_merge(base, _load_yaml(f"coefficients_{a}.yaml") or {})
    return base


@cache
def sources() -> dict[str, Any]:
    """sources.yaml をエリアに合わせて整形（{plateau_city} 等の置換、areas 指定のあるものは該当エリアのみ）."""
    import copy

    raw = _load_yaml("sources.yaml")
    a = area()["area"]
    ctx = {
        "plateau_city": area().get("plateau", {}).get("city_label", ""),
        "plateau_package": area().get("plateau", {}).get("package", ""),
        "pref_name": a.get("pref_name", ""),
    }
    out = copy.deepcopy(raw)
    kept = []
    for s in out["sources"]:
        if s.get("areas") and a["id"] not in s["areas"]:
            continue
        for k, v in list(s.items()):
            if isinstance(v, str):
                for key, val in ctx.items():
                    v = v.replace("{" + key + "}", str(val))
                s[k] = v
        kept.append(s)
    out["sources"] = kept
    return out


def paths() -> Paths:
    return Paths()


def bbox() -> tuple[float, float, float, float]:
    return tuple(area()["area"]["bbox"])  # type: ignore[return-value]


def epsg_plane() -> int:
    return int(area()["area"]["epsg_plane"])


DAY_TYPES = ("weekday", "holiday", "all")
TIME_BANDS = ("day", "night", "all")
# 人流オープンデータのコード → 本システムの語彙
DAYFLAG_MAP = {"0": "holiday", "1": "weekday", "2": "all"}
TIMEZONE_MAP = {"0": "day", "1": "night", "2": "all"}
FROM_AREA_MAP = {"0": "same_city", "1": "same_pref", "2": "same_region", "3": "other_region"}
