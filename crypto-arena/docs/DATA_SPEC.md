# データ提供仕様 (Data Intake Spec)

Crypto.com Arena 1to1 マーケティング基盤への投入データ定義。

- 形式: **UTF-8 CSV** (ヘッダ行必須) または JSON Lines。Excel の場合はシート1枚=1テーブル
- 日時: ISO 8601 ローカル `2025-11-14T19:30:00-08:00`
- 欠損: 空文字。`0` で埋めない
- 個人情報: **氏名・メール・電話・住所番地は不要**。`fan_id` は**ハッシュ化済みの仮名ID**でお願いします
  (居住地は ZIP5 まで、生年月日は年代バンドまで)
- 実データが無い項目は**列ごと省略可**。到着した列だけ順次基盤に接続します

---

## P0 — これだけで基盤が起動します

### 1. `seatmap.csv` — 座席マスタ ★最重要

3Dボウルの生成元。これが実データだと**席位置・視認・露出の全計算が実測ベース**になります。

| 列 | 型 | 例 | 説明 |
|---|---|---|---|
| `section` | str | `111` | 公式セクション名。`PR7`, `CS-A` 等も可 |
| `row` | str | `A` / `12` | 列 |
| `seat` | int | `7` | 席番 |
| `tier` | enum | `floor`/`100`/`premier`/`suite`/`300` | 層 |
| `price_category` | str | `LOWER_SIDELINE` | 価格カテゴリコード |
| `x_m`,`y_m`,`z_m` | float | `-12.40, 3.85, 8.20` | **コート中心を原点**とした席位置(m)。x=東, y=高さ, z=北 |
| `facing_deg` | float | `90` | 座席の向き (北=0, 東=90) |
| `is_ada` | 0/1 | `0` | 車椅子席 |
| `is_obstructed` | 0/1 | `0` | 見切れ席 |

> 座標が無い場合: `section`,`row`,`seat`,`tier` だけでも可。公式席図から幾何生成し、
> 実測が来た時点で差し替えます。**セクションごとの列数・席数だけでも精度が大きく上がります。**

### 2. `events.csv` — 興行マスタ

| 列 | 型 | 例 |
|---|---|---|
| `event_id` | str | `LAL-2025-11-14` |
| `event_datetime` | iso | `2025-11-14T19:30:00-08:00` |
| `format` | enum | `NBA`/`NHL`/`WNBA`/`CONCERT`/`OTHER` — フロア形状の切替に使用 |
| `home_team` | str | `Lakers` |
| `opponent_or_artist` | str | `Golden State Warriors` |
| `capacity` | int | `19079` |
| `attendance` | int | `18997` |
| `tickets_sold` | int | `19012` |
| `gross_revenue_usd` | float | `2841500` |
| `day_of_week` | str | `Fri` |
| `is_national_tv` | 0/1 | `1` |
| `promotion` | str | `Giveaway Night` |

### 3. `tickets.csv` — 発券明細 ★1to1の背骨

1行 = 1席 1興行。**ここに `fan_id` が入ることで1to1になります。**

| 列 | 型 | 例 | 説明 |
|---|---|---|---|
| `ticket_id` | str | `T-88231904` | |
| `event_id` | str | `LAL-2025-11-14` | |
| `fan_id` | str | `f_9a3e...` | **仮名ID**。空でも可(その場合は集計分析のみ) |
| `section`,`row`,`seat` | | `111,A,7` | seatmap と結合 |
| `channel` | enum | `SEASON`/`PARTIAL`/`PRESALE`/`WEB`/`RESALE`/`GROUP`/`BOX_OFFICE`/`COMP` |
| `face_price_usd` | float | `728` | |
| `paid_price_usd` | float | `655` | 実売価格 (割引後) |
| `purchased_at` | iso | `2025-09-02T10:14:00-07:00` | リードタイム分析に使用 |
| `is_resale` | 0/1 | `1` | |
| `resale_price_usd` | float | `910` | 二次流通価格 → 需要の真値推定に使用 |
| `scanned` | 0/1 | `1` | no-show 率 |
| `scanned_at` | iso | `2025-11-14T18:52:00-08:00` | 到着分布 → OD/人流の実測化 |
| `gate` | str | `Gate A` | |

---

## P1 — 分析の解像度を大きく上げます

### 4. `fans.csv` — 個客マスタ

| 列 | 型 | 例 | 説明 |
|---|---|---|---|
| `fan_id` | str | `f_9a3e...` | |
| `zip5` | str | `90015` | **ZIP5まで**。OD分析・商圏の実測化 |
| `country` | str | `US` | インバウンド判定 |
| `age_band` | enum | `25-34` | |
| `acquired_at` | date | `2019-10-22` | 初回接点 |
| `member_tier` | str | `Season / Half / Flex / None` | |
| `season_ticket_years` | int | `6` | |
| `lifetime_value_usd` | float | `14820` | 無ければ計算します |
| `games_attended_ltm` | int | `18` | |
| `team_affinity` | str | `Lakers` / `Kings` / `Both` | |
| `email_optin`,`push_optin` | 0/1 | | |
| `app_installed` | 0/1 | | |
| `renewed_last_season` | 0/1 | | チャーン予測の教師ラベル |

### 5. `pos_transactions.csv` — 場内購買 (F&B / グッズ)

| 列 | 型 | 例 |
|---|---|---|
| `txn_id`,`event_id`,`fan_id` | str | |
| `stand_id` | str | `FB-212` |
| `txn_at` | iso | `2025-11-14T20:41:00-08:00` |
| `category` | enum | `FOOD`/`BEVERAGE`/`ALCOHOL`/`MERCH`/`PARKING` |
| `amount_usd` | float | `47.50` |
| `item_count` | int | `3` |

### 6. `stands.csv` — 売店マスタ (場内3D配置に使用)

`stand_id, name, level(100/premier/300), type(FB/MERCH), x_m, y_m, z_m, lanes`

### 7. `sponsor_inventory.csv` — スポンサー媒体在庫 ★視認測定の対象

| 列 | 型 | 例 | 説明 |
|---|---|---|---|
| `board_id` | str | `LED-CS-W` | |
| `sponsor_name` | str | `Delta` | |
| `type` | enum | `COURTSIDE_LED`/`RIBBON`/`SCOREBOARD`/`WALL`/`CONCOURSE`/`FLOOR_DECAL` |
| `x_m`,`y_m`,`z_m` | float | `-8.6, 0.85, 0` | コート中心原点 |
| `width_m`,`height_m` | float | `22, 0.95` | |
| `normal_deg` | float | `90` | 面の向き |
| `share_of_time_pct` | float | `12.5` | LEDのローテーション占有率 |
| `annual_contract_usd` | float | `1800000` | 媒体価値の実測換算に使用 |
| `guaranteed_impressions` | int | `2400000` | |

---

## P2 — あると1to1が完成します

### 8. `crm_engagement.csv` — CRM接触ログ

`fan_id, campaign_id, channel(EMAIL/PUSH/SMS/PAID_SOCIAL), sent_at, opened, clicked, converted, revenue_usd`

### 9. `od_origins.csv` — 来場元・交通手段 (実測がある場合)

`origin_id, name, lat, lon, share_pct, mode(CAR/METRO/RIDESHARE/WALK/BUS), avg_travel_min`

> 無い場合は `fans.zip5` + `tickets.scanned_at` から推定生成します。

### 10. `parking.csv`

`lot_id, name, lat, lon, capacity, price_usd, avg_occupancy_pct`

### 11. `wifi_beacon.csv` — 場内滞在ログ (あれば回遊の実測化)

`fan_id, event_id, zone_id, entered_at, dwell_sec`

---

## 参考資料としていただけると助かるもの

- 公式席図の**ベクター版** (PDF/SVG/DWG) — 2D席図モジュールの精度が上がります
- ボウル断面図・BIM/IFC/Revit — 視認遮蔽計算が実測化されます
- スポンサー看板の**寸法入り配置図**
- 直近シーズンの**セクション別販売率**サマリ (これだけでも `gameOcc()` が実測に切り替わります)

---

## 最小スタート

**`seatmap.csv` の section/row/seat と、`tickets.csv` 1試合分**があれば
実データ接続の第一版を組み上げられます。
それも待たずに、まず**公式席図ベースの19,079席ボウル + 合成ファンデータ**で
基盤の骨格を先行して作ることも可能です。
