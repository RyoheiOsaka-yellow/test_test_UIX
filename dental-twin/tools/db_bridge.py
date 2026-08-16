#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""db_bridge.py — findings.json と DB の受け渡し（ファイル経由）

  # 所見JSON → DB 投入用の SQL
  $ python3 tools/db_bridge.py export data/findings_sample.json -o dist/exam.sql

  # DB のクエリ結果(JSON) → ビューアが読む findings.json
  $ python3 tools/db_bridge.py import dist/rows.json -o dist/findings.json

  # 往復テスト（export → import で所見が一致するか）
  $ python3 tools/db_bridge.py roundtrip data/findings_sample.json

**ビューアからは通信しない**（CLAUDE.md §1-5 / SPEC §6.4）。院内クローズド
ネットワーク要件のため、DB との往復はこのツールがファイルで仲介する。

`import` が受け取る「クエリ結果 JSON」は、各テーブルを行の配列にしたもの:
  {"examinations":[...], "tooth_status":[...], "surface_findings":[...],
   "perio_measurements":[...], "treatment_plans":[...]}
"""

import argparse
import json
import os
import sys

SURFACES = ("M", "D", "B", "L", "O", "I")
PERIO_SITES = ("MB", "B", "DB", "ML", "L", "DL")


# ------------------------------------------------------------------ SQL 出力
def q(v):
    """SQL リテラル化。文字列は必ずエスケープする"""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def export_sql(doc):
    exam = doc.get("exam_id") or "E-UNKNOWN"
    lines = [
        "-- DENTAL TWIN: findings.json → SQL（SPEC §6.4）",
        "-- 患者氏名は書き出さない。chart_no / patient_ref の対応のみ",
        "BEGIN;",
        "",
        "-- 検査（1来院 = 1レコード）",
        "INSERT INTO examinations (exam_id, patient_id, exam_date, examiner_id, note)",
        "SELECT %s, p.patient_id, %s, %s, %s FROM patients p WHERE p.chart_no = %s"
        % (q(exam), q(doc.get("exam_date")), q(doc.get("examiner")),
           q(doc.get("note")), q(doc.get("patient_ref"))),
        "ON CONFLICT (exam_id) DO NOTHING;",
        "",
    ]

    for t in doc.get("teeth", []):
        fdi = t["fdi"]
        lines.append(
            "INSERT INTO tooth_status (exam_id, fdi, status, mobility, furcation, note) "
            "VALUES (%s, %s, %s, %s, %s, %s);"
            % (q(exam), q(fdi), q(t.get("status", "SOUND")),
               q(t.get("mobility")), q(t.get("furcation")), q(t.get("note"))))

        # 歯面所見は 1 行 1 面（"MOD" のような連結文字列にしない）
        for s in t.get("surfaces", []):
            surf = s.get("surface")
            if surf not in SURFACES:
                print("  ⚠ 未知の歯面をスキップ: %s %s" % (fdi, surf), file=sys.stderr)
                continue
            is_rest = s.get("finding") == "RESTORED"
            lines.append(
                "INSERT INTO surface_findings (exam_id, fdi, surface, cervical, "
                "finding_type, caries_grade, icdas, cavity_class, material, "
                "placed_on, note) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);"
                % (q(exam), q(fdi), q(surf), q(bool(s.get("cervical", False))),
                   q("RESTORATION" if is_rest else "CARIES"),
                   q(None if is_rest else s.get("finding")),
                   q(s.get("icdas")), q(s.get("cavity_class")),
                   q(s.get("material")), q(s.get("placed_on")), q(s.get("note"))))

        for site, m in (t.get("perio") or {}).items():
            if site not in PERIO_SITES:
                continue
            lines.append(
                "INSERT INTO perio_measurements (exam_id, fdi, site, pd, gm, bop, "
                "pus, plaque) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);"
                % (q(exam), q(fdi), q(site), q(m.get("pd")), q(m.get("gm", 0)),
                   q(bool(m.get("bop", False))), q(bool(m.get("pus", False))),
                   q(bool(m.get("plaque", False)))))

    for p in doc.get("plan", []):
        lines.append(
            "INSERT INTO treatment_plans (exam_id, fdi, surfaces, procedure, "
            "priority, est_visits, note) VALUES (%s, %s, %s, %s, %s, %s, %s);"
            % (q(exam), q(p["fdi"]), q(p.get("surfaces")), q(p["procedure"]),
               q(p.get("priority")), q(p.get("visits")), q(p.get("note"))))

    lines += ["", "COMMIT;", ""]
    return "\n".join(lines)


# ---------------------------------------------------------------- JSON 復元
def import_rows(rows):
    """クエリ結果の行配列 → findings.json"""
    exams = rows.get("examinations") or []
    ex = exams[0] if exams else {}
    doc = {
        "schema_version": "1.0",
        "patient_ref": ex.get("chart_no") or ex.get("patient_ref") or "P-UNKNOWN",
        "exam_id": ex.get("exam_id") or "E-UNKNOWN",
        "exam_date": ex.get("exam_date"),
        "examiner": ex.get("examiner_id"),
        "notation": "FDI",
        "teeth": [],
        "plan": [],
    }
    if ex.get("note"):
        doc["note"] = ex["note"]

    by = {}

    def tooth(fdi):
        if fdi not in by:
            by[fdi] = {"fdi": fdi, "status": "SOUND", "surfaces": []}
        return by[fdi]

    for r in rows.get("tooth_status") or []:
        t = tooth(int(r["fdi"]))
        t["status"] = r.get("status", "SOUND")
        for k_src, k_dst in (("mobility", "mobility"), ("furcation", "furcation"),
                             ("note", "note")):
            if r.get(k_src) is not None:
                t[k_dst] = r[k_src]

    for r in rows.get("surface_findings") or []:
        t = tooth(int(r["fdi"]))
        s = {"surface": r["surface"]}
        if r.get("finding_type") == "RESTORATION":
            s["finding"] = "RESTORED"
            if r.get("material"):
                s["material"] = r["material"]
            if r.get("placed_on"):
                s["placed_on"] = r["placed_on"]
        else:
            s["finding"] = r.get("caries_grade") or "SOUND"
        for k in ("icdas", "cavity_class", "note"):
            if r.get(k) is not None:
                s[k] = r[k]
        if r.get("cervical"):
            s["cervical"] = True
        t["surfaces"].append(s)

    for r in rows.get("perio_measurements") or []:
        t = tooth(int(r["fdi"]))
        p = t.setdefault("perio", {})
        m = {"pd": r.get("pd"), "gm": r.get("gm", 0), "bop": bool(r.get("bop"))}
        for k in ("pus", "plaque"):
            if r.get(k):
                m[k] = True
        p[r["site"]] = m

    for r in rows.get("treatment_plans") or []:
        p = {"fdi": int(r["fdi"]), "procedure": r["procedure"]}
        if r.get("surfaces") is not None:
            p["surfaces"] = r["surfaces"]
        if r.get("priority") is not None:
            p["priority"] = r["priority"]
        if r.get("est_visits") is not None:
            p["visits"] = r["est_visits"]
        if r.get("note"):
            p["note"] = r["note"]
        doc["plan"].append(p)

    doc["teeth"] = [by[k] for k in sorted(by)]
    return doc


# --------------------------------------------------------------- 往復テスト
def doc_to_rows(doc):
    """DB を経由せず、export と同じ写像で行データを作る（往復テスト用）"""
    exam = doc.get("exam_id")
    rows = {
        "examinations": [{"exam_id": exam, "chart_no": doc.get("patient_ref"),
                          "exam_date": doc.get("exam_date"),
                          "examiner_id": doc.get("examiner"),
                          "note": doc.get("note")}],
        "tooth_status": [], "surface_findings": [],
        "perio_measurements": [], "treatment_plans": [],
    }
    for t in doc.get("teeth", []):
        rows["tooth_status"].append({
            "exam_id": exam, "fdi": t["fdi"], "status": t.get("status", "SOUND"),
            "mobility": t.get("mobility"), "furcation": t.get("furcation"),
            "note": t.get("note")})
        for s in t.get("surfaces", []):
            is_rest = s.get("finding") == "RESTORED"
            rows["surface_findings"].append({
                "exam_id": exam, "fdi": t["fdi"], "surface": s["surface"],
                "cervical": bool(s.get("cervical", False)),
                "finding_type": "RESTORATION" if is_rest else "CARIES",
                "caries_grade": None if is_rest else s.get("finding"),
                "icdas": s.get("icdas"), "cavity_class": s.get("cavity_class"),
                "material": s.get("material"), "placed_on": s.get("placed_on"),
                "note": s.get("note")})
        for site, m in (t.get("perio") or {}).items():
            rows["perio_measurements"].append({
                "exam_id": exam, "fdi": t["fdi"], "site": site,
                "pd": m.get("pd"), "gm": m.get("gm", 0),
                "bop": bool(m.get("bop", False)),
                "pus": bool(m.get("pus", False)),
                "plaque": bool(m.get("plaque", False))})
    for p in doc.get("plan", []):
        rows["treatment_plans"].append({
            "exam_id": exam, "fdi": p["fdi"], "surfaces": p.get("surfaces"),
            "procedure": p["procedure"], "priority": p.get("priority"),
            "est_visits": p.get("visits"), "note": p.get("note")})
    return rows


def core(doc):
    """比較用に所見の本質だけを取り出す（キー順・欠損値の差を無視する）"""
    teeth = {}
    for t in doc.get("teeth", []):
        surf = {}
        for s in t.get("surfaces", []):
            k = "O" if s["surface"] == "I" else s["surface"]
            surf[k] = (s.get("finding"), s.get("material"), s.get("icdas"),
                       s.get("cavity_class"))
        perio = {}
        for site, m in (t.get("perio") or {}).items():
            perio[site] = (m.get("pd"), m.get("gm", 0), bool(m.get("bop", False)))
        teeth[t["fdi"]] = (t.get("status", "SOUND"), t.get("mobility"),
                           t.get("furcation"), tuple(sorted(surf.items())),
                           tuple(sorted(perio.items())))
    plan = sorted((p["fdi"], p["procedure"], p.get("surfaces"),
                   p.get("priority"), p.get("visits")) for p in doc.get("plan", []))
    return teeth, plan


def roundtrip(doc):
    back = import_rows(doc_to_rows(doc))
    a_t, a_p = core(doc)
    b_t, b_p = core(back)
    diffs = []
    for fdi in sorted(set(a_t) | set(b_t)):
        if a_t.get(fdi) != b_t.get(fdi):
            diffs.append("歯 %s: %r → %r" % (fdi, a_t.get(fdi), b_t.get(fdi)))
    if a_p != b_p:
        diffs.append("治療計画が不一致")
    return diffs, back


def main(argv=None):
    ap = argparse.ArgumentParser(description="findings.json と DB の受け渡し")
    ap.add_argument("mode", choices=["export", "import", "roundtrip"])
    ap.add_argument("path")
    ap.add_argument("-o", "--out", default=None)
    a = ap.parse_args(argv)

    with open(a.path, encoding="utf-8") as f:
        data = json.load(f)

    if a.mode == "export":
        sql = export_sql(data)
        out = a.out or os.path.splitext(a.path)[0] + ".sql"
        with open(out, "w", encoding="utf-8") as f:
            f.write(sql)
        print("[OK] %s  (%d 文)" % (out, sql.count("INSERT INTO")))
        return 0

    if a.mode == "import":
        doc = import_rows(data)
        out = a.out or os.path.splitext(a.path)[0] + "_findings.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        print("[OK] %s  (歯 %d / 計画 %d)" % (out, len(doc["teeth"]), len(doc["plan"])))
        return 0

    diffs, _ = roundtrip(data)
    n_surf = sum(len(t.get("surfaces", [])) for t in data.get("teeth", []))
    n_perio = sum(len(t.get("perio") or {}) for t in data.get("teeth", []))
    print("往復テスト: 歯 %d / 歯面所見 %d / 歯周計測 %d / 計画 %d"
          % (len(data.get("teeth", [])), n_surf, n_perio, len(data.get("plan", []))))
    if diffs:
        print("❌ 往復で一致しません")
        for d in diffs[:10]:
            print("   " + d)
        return 1
    print("✅ export → import で所見が完全に一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
