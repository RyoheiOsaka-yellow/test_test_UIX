"""FlowSource プロトコル: どの人流ソースも mesh_flow スキーマに正規化して返す.

mesh_flow(mesh_code, period, day_type, time_band, population, origin_class, source)
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import pandas as pd

MESH_FLOW_COLUMNS = ["mesh_code", "period", "day_type", "time_band", "population", "origin_class", "source"]


@runtime_checkable
class FlowSource(Protocol):
    name: str

    def available_periods(self) -> list[str]: ...

    def load(self, bbox: tuple[float, float, float, float], period: str) -> pd.DataFrame:
        """mesh_flow スキーマに正規化して返す."""
        ...

    def load_origin_mix(self, city_codes: list[str], period: str) -> pd.DataFrame:
        """来街者構成（居住地区分別の滞在人口）。無ければ空の DataFrame."""
        ...


def get_source(name: str = "open_mlit") -> FlowSource:
    if name == "open_mlit":
        from jinryu.adapters.open_mlit import OpenMlitFlow

        return OpenMlitFlow()
    if name == "commercial_stub":
        from jinryu.adapters.commercial_stub import CommercialStubFlow

        return CommercialStubFlow()
    raise ValueError(f"unknown flow source: {name}")


def validate_mesh_flow(df: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in MESH_FLOW_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"mesh_flow に列が不足: {missing}")
    return df[MESH_FLOW_COLUMNS]
