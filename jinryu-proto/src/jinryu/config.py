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


def _load_yaml(name: str) -> dict[str, Any]:
    with open(CONFIG_DIR / name, encoding="utf-8") as f:
        return yaml.safe_load(f)


@cache
def area() -> dict[str, Any]:
    return _load_yaml("area.yaml")


@cache
def coefficients() -> dict[str, Any]:
    return _load_yaml("coefficients.yaml")


@cache
def sources() -> dict[str, Any]:
    return _load_yaml("sources.yaml")


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
