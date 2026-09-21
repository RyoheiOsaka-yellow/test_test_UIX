"""オープンデータの取得（data/raw）。既存ファイルはスキップする.

- 人流オープンデータ: CKAN リソース URL（302 → S3 署名 URL）
- 国土数値情報: nlftp.mlit.go.jp
- OSM: api.openstreetmap.org/api/0.6/map をタイル分割（50,000 ノード制限）
- PLATEAU: 5GB の CityGML zip を HTTP Range で開き、対象 3次メッシュの bldg だけ取り出す
- 岡山市 AIカメラ通行量: 市サイトの xlsx
"""

from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path

import requests
import typer

from jinryu import config

TIMEOUT = 300
UA = {"User-Agent": "jinryu-proto/0.1 (research prototype)"}


def _download(url: str, dest: Path, retries: int = 3) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        typer.echo(f"  skip {dest.name}")
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    for i in range(retries):
        try:
            with requests.get(url, headers=UA, stream=True, timeout=TIMEOUT, allow_redirects=True) as r:
                r.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            typer.echo(f"  ok   {dest.name} ({dest.stat().st_size // 1024} KB)")
            return True
        except Exception as e:  # noqa: BLE001
            typer.echo(f"  retry {i + 1}/{retries} {dest.name}: {e}")
    return False


def fetch_mlit_flow():
    typer.echo("人流オープンデータ")
    src = next(s for s in config.sources()["sources"] if s["id"] == "mlit_flow")
    raw = config.paths().raw / "mlit_flow"
    for url in src["files"]:
        name = url.rsplit("/", 1)[-1]
        _download(url, raw / name)


def fetch_ksj():
    typer.echo("国土数値情報")
    raw = config.paths().raw / "ksj"
    for s in config.sources()["sources"]:
        if s["id"].startswith("ksj_"):
            for url in s.get("files", []):
                _download(url, raw / url.rsplit("/", 1)[-1])


def fetch_osm_tiles():
    typer.echo("OSM タイル")
    x0, y0, x1, y1 = config.bbox()
    nx, ny = config.area()["osm"]["tiles_x"], config.area()["osm"]["tiles_y"]
    raw = config.paths().raw / "osm"
    for i in range(nx):
        for j in range(ny):
            bb = (
                x0 + (x1 - x0) * i / nx,
                y0 + (y1 - y0) * j / ny,
                x0 + (x1 - x0) * (i + 1) / nx,
                y0 + (y1 - y0) * (j + 1) / ny,
            )
            b = ",".join(f"{v:.4f}" for v in bb)
            _download(
                f"https://api.openstreetmap.org/api/0.6/map?bbox={b}", raw / f"t_{b.replace(',', '_')}.xml"
            )


class _RemoteFile(io.RawIOBase):
    """HTTP Range で読む読み取り専用ファイル（zipfile に渡す）."""

    def __init__(self, url: str, size: int):
        self.url, self.size, self.pos, self.n_requests = url, size, 0, 0

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos

    def tell(self):
        return self.pos

    def readable(self):
        return True

    def seekable(self):
        return True

    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0:
            return 0
        r = requests.get(
            self.url, headers={**UA, "Range": f"bytes={self.pos}-{self.pos + n - 1}"}, timeout=TIMEOUT
        )
        if r.status_code != 206:
            raise OSError(f"range request failed: {r.status_code}")
        b[: len(r.content)] = r.content
        self.pos += len(r.content)
        self.n_requests += 1
        return len(r.content)


def fetch_plateau_bldg():
    typer.echo("PLATEAU 建物（部分取得）")
    pl = config.area()["plateau"]
    dest = config.paths().raw / "plateau" / "bldg"
    dest.mkdir(parents=True, exist_ok=True)
    codes = set(config.area()["mesh3_codes"])
    size = pl.get("citygml_zip_size") or int(
        requests.head(pl["citygml_zip_url"], headers=UA, timeout=60).headers["content-length"]
    )
    rf = _RemoteFile(pl["citygml_zip_url"], size)
    zf = zipfile.ZipFile(io.BufferedReader(rf, buffer_size=1 << 20))
    members = [
        n
        for n in zf.namelist()
        if "/bldg/" in n and n.endswith(".gml") and Path(n).name.split("_")[0] in codes
    ]
    typer.echo(
        f"  {len(members)} files / {sum(zf.getinfo(m).compress_size for m in members) // (1 << 20)} MB compressed"
    )
    for m in members:
        out = dest / Path(m).name
        if out.exists():
            typer.echo(f"  skip {out.name}")
            continue
        with zf.open(m) as src, open(out, "wb") as f:
            f.write(src.read())
        typer.echo(f"  ok   {out.name}")


def fetch_okayama_counts():
    typer.echo("岡山市 AIカメラ通行量")
    cfg = config.area()["counts"]
    raw = config.paths().raw / "counts_okayama"
    for month in cfg["months"]:
        y, m = month.split("-")
        page = cfg["page_ids"].get(y)
        if not page:
            continue
        try:
            html = requests.get(
                f"https://www.city.okayama.jp/shisei/{page}.html", headers=UA, timeout=60
            ).text
        except Exception as e:  # noqa: BLE001
            typer.echo(f"  page {page} 取得失敗: {e}")
            continue
        for suffix in ("D", "M"):
            m_ = re.search(rf'href="(\./cmsfiles/[^"]*{y}{m}{suffix}\.xlsx)"', html)
            if m_:
                _download(
                    "https://www.city.okayama.jp/shisei/" + m_.group(1)[2:], raw / f"{y}{m}{suffix}.xlsx"
                )
            else:
                typer.echo(f"  {y}{m}{suffix}.xlsx はページに見当たらない")
