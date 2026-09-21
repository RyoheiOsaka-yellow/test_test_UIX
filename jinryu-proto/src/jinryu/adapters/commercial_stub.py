"""商用人流データ（Agoop / KDDI Location Analyzer / モバイル空間統計 等）のアダプタ雛形.

v0.1 では契約していないため、提供フォーマットが決まり次第 `load` を実装する。
想定: 100m〜500m メッシュ・1時間帯別・属性別。mesh_flow へ正規化する際は
  - mesh_code: 提供メッシュコード（粒度が違っても downscale は「メッシュ→建物」の一般形で動く）
  - time_band: 提供時間帯を config.TIME_BANDS に丸めるか、拡張する（downscale の α も同じ語彙にする）
"""

from __future__ import annotations

import pandas as pd

from jinryu.adapters.base import MESH_FLOW_COLUMNS


class CommercialStubFlow:
    name = "commercial_stub"

    def available_periods(self) -> list[str]:
        return []

    def load(self, bbox, period: str) -> pd.DataFrame:
        raise NotImplementedError("商用データのサンプル提供後に実装（docs/QUESTIONS.md Q3）")

    def load_origin_mix(self, city_codes: list[str], period: str) -> pd.DataFrame:
        return pd.DataFrame(
            columns=["city_code", "period", "day_type", "time_band", "origin_class", "population", "source"]
        )


__all__ = ["CommercialStubFlow", "MESH_FLOW_COLUMNS"]
