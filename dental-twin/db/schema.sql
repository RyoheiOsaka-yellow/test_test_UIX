-- schema.sql — DENTAL TWIN の DB スキーマ (PostgreSQL)
--
-- ⚠ このファイルは SPEC.md §7.2 から生成された「写し」です。
--    変更するときは必ず SPEC.md を先に直してください（SPEC が唯一の正）。
--
-- 設計原則:
--   * 「現在の状態」テーブルを持たない。常に examinations の時系列で表現する
--   * 歯面所見は 1 行 1 面に正規化する（"MOD" のような文字列を主キーに含めない）
--   * 患者氏名は置かない。電子カルテ側の chart_no で突合する

-- 患者
CREATE TABLE patients (
  patient_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_no     TEXT UNIQUE NOT NULL,       -- 院内カルテ番号
  birth_date   DATE,
  sex          CHAR(1) CHECK (sex IN ('M','F','O')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 検査（来院1回 = 1レコード）
CREATE TABLE examinations (
  exam_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  exam_date    DATE NOT NULL,
  examiner_id  TEXT,
  exam_type    TEXT CHECK (exam_type IN ('INITIAL','RECALL','TREATMENT','POST_OP')),
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON examinations (patient_id, exam_date DESC);

-- 歯単位の状態
CREATE TABLE tooth_status (
  exam_id      UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
  fdi          SMALLINT NOT NULL CHECK (
                 (fdi BETWEEN 11 AND 48) OR (fdi BETWEEN 51 AND 85)),
  status       TEXT NOT NULL,             -- SOUND / CARIES / MISSING / IMPLANT ...
  mobility     SMALLINT CHECK (mobility BETWEEN 0 AND 3),
  furcation    SMALLINT CHECK (furcation BETWEEN 0 AND 3),
  note         TEXT,
  PRIMARY KEY (exam_id, fdi)
);

-- 歯面単位の所見（コア）
CREATE TABLE surface_findings (
  finding_id   BIGSERIAL PRIMARY KEY,
  exam_id      UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
  fdi          SMALLINT NOT NULL,
  surface      CHAR(1) NOT NULL CHECK (surface IN ('M','D','B','L','O','I')),
  cervical     BOOLEAN NOT NULL DEFAULT FALSE,
  finding_type TEXT NOT NULL,             -- CARIES / RESTORATION / FRACTURE / WEAR / EROSION
  caries_grade TEXT CHECK (caries_grade IN ('CO','C1','C2','C3','C4')),
  icdas        SMALLINT CHECK (icdas BETWEEN 0 AND 6),
  cavity_class TEXT CHECK (cavity_class IN ('I','II','III','IV','V','VI')),
  material     TEXT,                       -- CR / IN_METAL / FMC / PFM ...
  placed_on    DATE,
  note         TEXT,
  UNIQUE (exam_id, fdi, surface, finding_type)
);
CREATE INDEX ON surface_findings (exam_id, fdi);

-- 歯周6点法
CREATE TABLE perio_measurements (
  exam_id      UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
  fdi          SMALLINT NOT NULL,
  site         TEXT NOT NULL CHECK (site IN ('MB','B','DB','ML','L','DL')),
  pd           SMALLINT CHECK (pd BETWEEN 0 AND 15),
  gm           SMALLINT CHECK (gm BETWEEN -5 AND 15),
  cal          SMALLINT GENERATED ALWAYS AS (pd + gm) STORED,
  bop          BOOLEAN DEFAULT FALSE,
  pus          BOOLEAN DEFAULT FALSE,
  plaque       BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (exam_id, fdi, site)
);

-- 治療計画
CREATE TABLE treatment_plans (
  plan_id      BIGSERIAL PRIMARY KEY,
  exam_id      UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
  fdi          SMALLINT NOT NULL,
  surfaces     TEXT,                       -- 'MOD' 等（表示用。判定はJOIN先で）
  procedure    TEXT NOT NULL,              -- CR_FILLING / INLAY / CROWN / EXTRACTION / RCT / SRP
  priority     SMALLINT DEFAULT 3,
  est_visits   SMALLINT,
  est_fee_yen  INTEGER,
  status       TEXT DEFAULT 'PLANNED'
                 CHECK (status IN ('PLANNED','AGREED','IN_PROGRESS','DONE','CANCELLED')),
  note         TEXT
);

-- 添付メディア（X線・口腔内写真・IOSスキャン）
CREATE TABLE media_assets (
  media_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
  media_type   TEXT CHECK (media_type IN ('XRAY_PA','XRAY_BW','PANO','CBCT','PHOTO','IOS_MESH')),
  fdi_refs     SMALLINT[],                 -- 関連歯
  storage_uri  TEXT NOT NULL,              -- 実体はDB外
  captured_at  TIMESTAMPTZ,
  meta         JSONB
);

-- 最新の歯単位状態を導出するビュー（SPEC §7.2 の設計原則）
CREATE OR REPLACE VIEW latest_tooth_status AS
SELECT DISTINCT ON (e.patient_id, ts.fdi)
       e.patient_id, ts.fdi, ts.status, ts.mobility, ts.furcation,
       e.exam_date, ts.exam_id
FROM tooth_status ts
JOIN examinations e USING (exam_id)
ORDER BY e.patient_id, ts.fdi, e.exam_date DESC;
