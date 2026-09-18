-- 003_meshes.sql — 集計メッシュ（正方 50/100/250m、地域メッシュ JIS X 0410、任意で H3）
-- 正方メッシュは EPSG:6673（JGD2011 平面直角 V 系, m）上で原点 (0,0) 基準に切る。mesh_id = 'sq<res>:<i>:<j>'
\set ON_ERROR_STOP on
SET client_min_messages TO WARNING;

-- 姫路市中心部の既定範囲（lon/lat）
CREATE OR REPLACE FUNCTION mobility.default_bbox() RETURNS geometry
LANGUAGE sql IMMUTABLE AS $$ SELECT ST_MakeEnvelope(134.648, 34.800, 134.735, 34.872, 4326) $$;

-- 点 → 正方メッシュ ID（空間結合なしで高速に割り当て）
CREATE OR REPLACE FUNCTION mobility.mesh_id_for(pt geometry, res integer) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT format('sq%s:%s:%s', res, floor(ST_X(m) / res)::int, floor(ST_Y(m) / res)::int)
  FROM (SELECT ST_Transform(pt, 6673) AS m) s
$$;

-- 正方メッシュの生成（bbox 内。既存 ID は保持）
CREATE OR REPLACE FUNCTION mobility.generate_square_meshes(res integer, bbox geometry DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  b geometry := COALESCE(bbox, mobility.default_bbox());
  m geometry := ST_Transform(b, 6673);
  i0 int := floor(ST_XMin(m) / res); i1 int := floor(ST_XMax(m) / res);
  j0 int := floor(ST_YMin(m) / res); j1 int := floor(ST_YMax(m) / res);
  n int;
BEGIN
  INSERT INTO mobility.meshes (mesh_id, mesh_type, resolution, geom, centroid, area_m2)
  SELECT format('sq%s:%s:%s', res, i, j), 'square' || res, res,
         ST_Transform(ST_SetSRID(ST_MakeEnvelope(i * res, j * res, (i + 1) * res, (j + 1) * res), 6673), 4326),
         ST_Transform(ST_SetSRID(ST_MakePoint((i + 0.5) * res, (j + 0.5) * res), 6673), 4326),
         res * res
  FROM generate_series(i0, i1) AS i, generate_series(j0, j1) AS j
  ON CONFLICT (mesh_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 地域メッシュ（JIS X 0410）: level 3=1km, 4=500m, 5=250m, 6=125m
CREATE OR REPLACE FUNCTION mobility.jis_mesh_code(lon double precision, lat double precision, lvl integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  p int := floor(lat * 1.5); u int := floor(lon - 100);
  q int := floor((lat * 1.5 - p) * 8); v int := floor((lon - 100 - u) * 8);
  r int := floor(((lat * 1.5 - p) * 8 - q) * 10); w int := floor(((lon - 100 - u) * 8 - v) * 10);
  la double precision := ((lat * 1.5 - p) * 8 - q) * 10 - r;
  lo double precision := ((lon - 100 - u) * 8 - v) * 10 - w;
  code text := format('%s%s%s%s%s%s', p, lpad(u::text, 2, '0'), q, v, r, w);
  k int; a int; bb int;
BEGIN
  FOR k IN 1..GREATEST(0, lvl - 3) LOOP
    a := CASE WHEN la < 0.5 THEN 0 ELSE 1 END; bb := CASE WHEN lo < 0.5 THEN 0 ELSE 1 END;
    code := code || (a * 2 + bb + 1)::text;
    la := (la - a * 0.5) * 2; lo := (lo - bb * 0.5) * 2;
  END LOOP;
  RETURN code;
END $$;

-- 地域メッシュの生成（bbox 内、level 4/5/6）。mesh_id = 'jis:<code>'
CREATE OR REPLACE FUNCTION mobility.generate_jis_meshes(lvl integer, bbox geometry DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  b geometry := COALESCE(bbox, mobility.default_bbox());
  dlat double precision := CASE lvl WHEN 3 THEN 1.0/120 WHEN 4 THEN 1.0/240 WHEN 5 THEN 1.0/480 ELSE 1.0/960 END;
  dlon double precision := CASE lvl WHEN 3 THEN 1.0/80  WHEN 4 THEN 1.0/160 WHEN 5 THEN 1.0/320 ELSE 1.0/640 END;
  res_m int := CASE lvl WHEN 3 THEN 1000 WHEN 4 THEN 500 WHEN 5 THEN 250 ELSE 125 END;
  n int;
BEGIN
  INSERT INTO mobility.meshes (mesh_id, mesh_type, resolution, geom, centroid, area_m2)
  SELECT 'jis:' || mobility.jis_mesh_code(x + dlon / 2, y + dlat / 2, lvl), 'jis', res_m,
         ST_MakeEnvelope(x, y, x + dlon, y + dlat, 4326),
         ST_SetSRID(ST_MakePoint(x + dlon / 2, y + dlat / 2), 4326),
         ST_Area(ST_MakeEnvelope(x, y, x + dlon, y + dlat, 4326)::geography)
  FROM generate_series(floor(ST_XMin(b) / dlon)::int, floor(ST_XMax(b) / dlon)::int) AS ix,
       generate_series(floor(ST_YMin(b) / dlat)::int, floor(ST_YMax(b) / dlat)::int) AS iy,
       LATERAL (SELECT ix * dlon AS x, iy * dlat AS y) c
  ON CONFLICT (mesh_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- H3（h3-pg 拡張がある場合のみ）: mesh_id = 'h3:<index>'。無ければ NOTICE を出してスキップ
CREATE OR REPLACE FUNCTION mobility.generate_h3_meshes(h3_res integer, bbox geometry DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE n int := 0; b geometry := COALESCE(bbox, mobility.default_bbox());
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'h3') THEN
    RAISE NOTICE 'h3 extension is not installed; skip (フロント側の六角格子は H3 相当の外接半径で代替)';
    RETURN 0;
  END IF;
  EXECUTE format($q$
    INSERT INTO mobility.meshes (mesh_id, mesh_type, resolution, geom, centroid, area_m2)
    SELECT 'h3:' || h, 'h3', %s, h3_cell_to_boundary_geometry(h), h3_cell_to_geometry(h), ST_Area(h3_cell_to_boundary_geometry(h)::geography)
    FROM h3_polygon_to_cells($1, %s) AS h
    ON CONFLICT (mesh_id) DO NOTHING $q$,
    CASE h3_res WHEN 8 THEN 461 WHEN 9 THEN 174 WHEN 10 THEN 66 ELSE 25 END, h3_res) USING b;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 既定範囲に 50 / 100 / 250 m と地域メッシュ 4〜6 次を作成
SELECT mobility.generate_square_meshes(50), mobility.generate_square_meshes(100), mobility.generate_square_meshes(250);
SELECT mobility.generate_jis_meshes(4), mobility.generate_jis_meshes(5), mobility.generate_jis_meshes(6);
SELECT mobility.generate_h3_meshes(9);

INSERT INTO mobility.schema_migrations (version) VALUES ('003_meshes') ON CONFLICT DO NOTHING;
