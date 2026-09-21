# 人流ポテンシャル評価プロトタイプ
# 使い方: make setup → make fetch → make ingest → make build → make calibrate → make serve
UV ?= uv
RUN = $(UV) run

.PHONY: setup fetch ingest build calibrate score serve test lint all demo

setup:
	$(UV) sync --extra dev

fetch:            ## オープンデータ取得 (data/raw)
	$(RUN) jinryu fetch

ingest:           ## 正規化テーブル生成 (data/processed/*.parquet)
	$(RUN) jinryu ingest

build:            ## ①建物配分 → ②OD → ③経路配分 → link_flow
	$(RUN) jinryu build

calibrate:        ## ④較正・評価 → docs/EVAL.md
	$(RUN) jinryu calibrate

score:            ## ⑤スコア表 (parcel_score)
	$(RUN) jinryu score

serve:            ## API + UI (http://localhost:8000)
	$(RUN) uvicorn jinryu.api.main:app --reload --port 8000

all: ingest build calibrate score

demo:             ## 同梱デモバンドル (data/demo) からそのまま起動
	JINRYU_DATA_DIR=data/demo $(RUN) uvicorn jinryu.api.main:app --port 8000

export-html:      ## サーバ不要の単一 HTML デモ → dist/jinryu-demo.html
	$(RUN) jinryu export-html

test:
	$(RUN) pytest -q

lint:
	$(RUN) ruff check src tests && $(RUN) ruff format --check src tests
