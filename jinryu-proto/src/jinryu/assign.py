"""③ 経路配分（最短経路 all-or-nothing）.

各発生ゾーンから Dijkstra で最短経路木を作り、T_ij を木に沿って下流から積み上げてリンク通行量にする。
木は距離抵抗・期間に依らないので、発生点ごとに 1 回計算して全ての (period, day_type, time_band) 列を同時に積み上げる。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import scipy.sparse as sp
from scipy.sparse.csgraph import dijkstra


@dataclass
class Network:
    node_ids: pd.Index
    graph: sp.csr_matrix
    pair_to_link: dict[tuple[int, int], int]  # (u_idx, v_idx) → link 行番号（両向き）
    link_ids: np.ndarray

    def idx(self, node_id) -> int:
        return int(self.node_ids.get_loc(node_id))


def build_network(links: pd.DataFrame) -> Network:
    node_ids = pd.Index(pd.unique(pd.concat([links.u, links.v])))
    u = node_ids.get_indexer(links.u)
    v = node_ids.get_indexer(links.v)
    cost = links.cost_m.values.astype(float)
    # 同一ノード対に複数リンクがある場合は最小コストのものだけ使う
    df = pd.DataFrame(
        {"u": np.minimum(u, v), "v": np.maximum(u, v), "cost": cost, "row": np.arange(len(links))}
    )
    df = df.sort_values("cost").drop_duplicates(["u", "v"])
    n = len(node_ids)
    g = sp.coo_matrix((df.cost.values, (df.u.values, df.v.values)), shape=(n, n)).tocsr()
    g = g + g.T
    pair = {}
    for a, b, r in zip(df.u.values, df.v.values, df.row.values, strict=False):
        pair[(int(a), int(b))] = int(r)
        pair[(int(b), int(a))] = int(r)
    return Network(node_ids=node_ids, graph=g, pair_to_link=pair, link_ids=links.link_id.values)


def shortest_tree(net: Network, origin_idx: int, limit: float) -> tuple[np.ndarray, np.ndarray]:
    dist, pred = dijkstra(
        net.graph, directed=False, indices=origin_idx, return_predecessors=True, limit=limit
    )
    return dist, pred


def accumulate(
    net: Network, dist: np.ndarray, pred: np.ndarray, node_loads: np.ndarray, link_flow: np.ndarray
) -> None:
    """node_loads (N×K): 各ノードを目的地とするトリップ量。木に沿って積み上げ link_flow (L×K) に加算する（in-place）."""
    reach = np.where(np.isfinite(dist) & (pred >= 0))[0]
    if len(reach) == 0:
        return
    order = reach[np.argsort(-dist[reach])]  # 遠い順に処理すれば子→親の順になる
    x = node_loads.copy()
    p2l = net.pair_to_link
    for j in order:
        pj = pred[j]
        xj = x[j]
        if not xj.any():
            continue
        x[pj] += xj
        r = p2l.get((int(pj), int(j)))
        if r is not None:
            link_flow[r] += xj
