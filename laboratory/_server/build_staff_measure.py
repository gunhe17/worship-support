from __future__ import annotations

import json
import urllib.parse
from pathlib import Path


# #
# config

HERE = Path(__file__).parent
LAB = HERE.parent
EXPERIMENT = next((LAB / "to-xml").glob("*/sheet-to-musicxml"))
RESULTS = EXPERIMENT / "results"
# LOG 41: 사람이 직접 본 오류, 자동 진단 의심 중 아직 직접 보지 않은 것
CONFIRMED = {
    "susanghanstreet_o-juyeo_1": "9마디 줄 오선 1개 놓침",
    "yerum-conti_naega-yesureul-motbakatseumnida-conti_1": "두 단 콘티: 왼쪽 단 오선 7개 중 2개만 찾음, 오른쪽 2번 타브 오표시",
    "j-us_abeojiui-sarang_2": "원본이 흐리게 처리된 미리보기 (표본 제외 후보)",
}
UNSEEN = {
    "markers-plate_saranaen-mankeum-saranghan-mankeum_1",
    "kim-su-ji_miral_1",
    "boksong_naega-cheoeum-jureul_1",
    "reubenmorgan_yakhan-naro_1",
    "teamshiek_ts16_1",
    "teamshiek_ts23_1",
}


# #
# run

def build() -> None:
    # load
    metadata = load_metadata()
    runs = {
        "500": json.load(open(RESULTS / "staff-500/out/staff.json"))["sheets"],
        "p6x": json.load(open(RESULTS / "staff-p6x/out/staff.json"))["sheets"],
    }
    # regions-500 = 새 오선 검출 기준 500장, 없으면 이전 검출기 기준 100장
    regions = json.load(open(next(p for p in (RESULTS / "regions-500/out/regions.json", RESULTS / "regions-100/out/regions.json") if p.exists())))
    regions = {k: v for k, v in regions.items() if "error" not in v}
    # sheet
    sheets = [
        sheet(id=id, runs=runs, metadata=metadata.get(id, {}), regions=regions.get(id)) for id in sorted(runs["500"])
    ]
    # render
    data = json.dumps({"sheets": sheets}, ensure_ascii=False, separators=(",", ":"))
    (HERE / "staff-measure.html").write_text(
        (HERE / "staff-measure.template.html").read_text().replace("__DATA__", data),
    )
    sidebar = [
        {"id": s["id"], "title": s["title"], "team": " · ".join(x for x in (s["team"], s["tag"], region_tag(s["regions"])) if x)} for s in sheets
    ]
    (HERE / "staff-sheets.json").write_text(json.dumps(sidebar, ensure_ascii=False, separators=(",", ":")))
    print("staff-measure.html", len(sheets), "sheets", sum(len(s["staves"]) for s in sheets), "staves", len(data) // 1024, "KB")


# #
# load

def load_metadata() -> dict[str, dict]:
    files = [*(EXPERIMENT / "refs/manifest").glob("*.json"), EXPERIMENT / "refs/manifest2/all_new_400.json"]
    return {
        m["file"].rsplit(".", 1)[0]: m for f in files for m in json.load(open(f))
    }


# #
# sheet

def sheet(*, id: str, runs: dict[str, dict], metadata: dict, regions: dict | None) -> dict:
    # p6x 재실행 6장은 최종 규칙 결과라 500장 결과보다 우선
    run = "p6x" if id in runs["p6x"] else "500"
    result = runs[run][id]
    tag = "확인된 오류" if id in CONFIRMED else "의심" if id in UNSEEN else ""
    note = CONFIRMED.get(id) or ("자동 진단 의심 · 아직 직접 보지 않음" if id in UNSEEN else "")
    return {
        "id": id,
        "title": metadata.get("title_ko", id),
        "team": metadata.get("team", id.split("_")[0]),
        "run": run,
        "tag": tag,
        "note": note,
        "img": "/" + urllib.parse.quote(str((RESULTS / f"staff-{run}/out/vis/{id}.jpg").relative_to(LAB))),
        "p": result["p"],
        "thickness": result["thickness"],
        "ink": result["ink_T"],
        "line_q90": result["line_q90"],
        "paper": result["paper"],
        "orig": result["orig"],
        "tabs": len(result["tabs"]),
        "staves": [staff(s) for s in result["staves"]],
        "regions": (
            region(regions) if regions else None
        ),
    }


def staff(found: dict) -> dict:
    diagnosis = found["diag"]
    return {
        "x": found["x"],
        "y": [min(s[1][0] for s in found["strips"]), max(s[1][4] for s in found["strips"])],
        "line": [diagnosis[f"l{i}"]["cov"] for i in range(5)],
        "up": diagnosis["up"]["cov"],
        "down": diagnosis["dn"]["cov"],
        "strips": found["n_strips"],
        "head": found["head_p"],
    }


# #
# region

def region(found: dict) -> dict:
    # regions-100은 가로 2000px, staff-500은 2480px로 정규화한 좌표
    scale = 2480 / 2000
    problems = {p["file"]: p["type"] for p in found["problems"]}
    split = found["split"]
    return {
        "ink": found["calibration"]["T"],
        "staves": [[round(v * scale) for v in s["box"]] for s in found["staff"]],
        "rows": [
            {
                "file": r["file"].removesuffix(".png"),
                "x": [round(v * scale) for v in split[min(r["band"], len(split) - 1)]["x"]],
                "y": [round(v * scale) for v in r["y"]],
                "height": r["h_gaps"],
                "kind": problems.get(r["file"]) or ("lyric" if r["lyric_boxes"] else "symbol"),
            }
            for r in found["rows"]
        ],
    }


def region_tag(found: dict | None) -> str:
    if not found:
        return ""
    if any(r["kind"] not in ("lyric", "symbol") for r in found["rows"]):
        return "영역 문제"
    return "영역"


# #
# cli

if __name__ == "__main__":
    build()
