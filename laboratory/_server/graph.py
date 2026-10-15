"""lab 의 마크다운 노드를 읽어 연구 지도 데이터를 만든다. serve.py가 요청마다 build()를 불러 뷰어에 넣는다.

  python3 _server/graph.py    # 노드 수와 내용 규칙 경고만 확인

내용 규칙: 가설·사실 = 제목 한 문장(본문 없음), 실험 = 정규화된 조건 줄(아래), 결과 = 성공/실패(status), 사실 kind = 성공 요인/실패 요인/부수 사실
파일 = 사이드바 트리:
  <기능>/feature.md        기능 (id = 폴더 이름)
  <기능>/hypotheses.md     그 기능의 가설·실험·결과·사실
    ## <가설 제목>                       가설 (id = 제목). 다음 줄 머리말 from: [사실]
    ### experiment-<x> — <제목>          실험. 머리말 where · tests: [가설], 본문 = 아래 여섯 줄 + "- 결과: 성공/실패"
                                         → 결과 노드 result-<x> (실험이 산출, 같은 가설의 사실을 모두 확정)
    ### 사실 아래 #### fact-<x> — <문장>   사실. 머리말 kind · supports / refutes: [가설] · about: [도구·기능]
  catalog.md               공유 노드: ## 도구 · 데이터셋 · 단계 · 지표 아래 ### <id> — <제목>
                             (도구 license, 데이터셋 n·unit·truth·where, 단계 tool, 지표 unit·better)
머리말은 제목 다음 한 줄 "키: 값 · 키: 값". 본문은 그 아래 (도구·기능만 설명 본문).
실험 본문 (참조와 값만, 이 순서):
  - 데이터: <데이터셋> · <데이터셋>          (a → b 는 같은 절차를 더 큰 세트로 넓힘, 규모는 마지막 단계)
  - 틀: <단계> → {조건} → <단계>             모든 조건에 공통인 절차, {조건} 정확히 한 번
  - 조건 A: <단계>(키=값|값) → <단계>        바꾼 것. 값|값 은 조건을 그만큼 펼친다. 단계 없음은 (없음)
  - 지표: <지표>(키=값) · <지표>
  - 기준: A(키=값).<지표> <= ≥ ≤ < >> <값>   성공 기준 (괄호로 펼친 조건 하나를 고를 수 있음)
  - 환경: kaggle-t4 × 1 · kaggle-cpu × 2 · 10.5h
  단계 자리에는 catalog의 단계 또는 도구 id. 규모 = 데이터 n 합 × 펼친 조건 수 (자동)
"""
import json, re, sys
from collections import Counter
from itertools import product
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent  # lab


def split_list(v):  # "[a, b(x, y), c]" → ["a", "b(x, y)", "c"] (괄호 안 쉼표는 나누지 않음)
    v = (v or "").strip()
    if not (v.startswith("[") and v.endswith("]")):
        return [v] if v else []
    out, depth, cur = [], 0, ""
    for ch in v[1:-1]:
        if ch == "," and depth == 0:
            out.append(cur.strip()); cur = ""
            continue
        depth += ch == "("; depth -= ch == ")"
        cur += ch
    return [x for x in out + [cur.strip()] if x]


def read(path):
    m = re.match(r"---\n(.*?)\n---\n?(.*)", path.read_text(), re.S)
    if not m:
        return {}, path.read_text()
    front = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            front[k.strip()] = v.strip()
    return front, m.group(2).strip()


def sections(path):  # "## 제목" / "### id — 제목" + 머리말 한 줄("키: 값 · 키: 값") + 본문 → [(level, id, front, body)]
    out = []
    for block in re.split(r"(?m)^(?=#{2,4} )", path.read_text()):
        m = re.match(r"(#{2,4}) ([^\n]+)\n?(.*)", block, re.S)
        if not m or m.group(2).strip() == "사실":
            continue
        nid, _, title = m.group(2).strip().partition(" — ")
        lines, front = m.group(3).strip().split("\n"), {"title": title or nid}
        if re.match(r"[a-z]+: ", lines[0]):
            front.update(kv.split(": ", 1) for kv in lines.pop(0).split(" · "))
        out.append((len(m.group(1)), nid, front, "\n".join(lines).strip()))
    return out


EXP_KEYS = ["데이터", "틀", "조건", "지표", "기준", "환경"]
ENVS = ("kaggle-t4", "kaggle-p100", "kaggle-cpu", "local")


def parse_el(text):  # "beat-this(model=final0|small0, x=1)" → ("beat-this", [("model", ["final0", "small0"]), ("x", ["1"])])
    m = re.fullmatch(r"\s*([\w.+-]+)\s*(?:\((.*)\))?\s*", text)
    if not m:
        return None, []
    params = [tuple(x.strip() for x in kv.split("=", 1)) for kv in re.split(r",\s*", m.group(2) or "") if "=" in kv]
    return m.group(1), [(k, v.split("|")) for k, v in params]


def expand(chain):  # 단계 사슬 → 펼친 조건 목록 (각 = {키: 값})
    axes = [(k, vs) for _, ps in chain for k, vs in ps if len(vs) > 1]
    return [dict(zip([k for k, _ in axes], combo)) for combo in product(*[vs for _, vs in axes])] or [{}]


def parse_experiment(n, nodes):
    """실험 본문 → spec, 오류, 관계. 규모는 데이터 n 합 × 펼친 조건 수."""
    errs, edges, rows = [], [], []
    for line in n["body"].splitlines():
        m = re.match(r"- (조건 \w+|[^:]+): (.*)$", line.strip())
        if not m:
            errs.append(f"실험 본문 줄 형식 '- 항목: 값' 아님 ({line.strip()[:20]})"); continue
        rows.append((m.group(1), m.group(2).strip()))
    keys = [k.split()[0] for k, _ in rows]
    order = [k for k in EXP_KEYS if k in keys]
    if [k for i, k in enumerate(keys) if i == 0 or k != keys[i - 1]] != order:
        errs.append("실험 항목 순서는 데이터 → 틀 → 조건 → 지표 → 기준 → 환경")
    for k in EXP_KEYS:
        if k not in keys:
            errs.append(f"실험 필수 항목 없음: {k}")
    val = {k: v for k, v in rows if not k.startswith("조건")}
    conds = [(k.split()[1], v) for k, v in rows if k.startswith("조건")]
    ref = lambda kind, name: nodes.get(name, {}).get("type") in kind

    # 데이터 (a → b 는 단계 확대)
    stages = [[x.strip() for x in st.split("·")] for st in val.get("데이터", "").split("→")]
    data = []
    for st in stages:
        for d in st:
            if not ref(("dataset",), d):
                errs.append(f"데이터셋 없음: {d}")
            else:
                edges.append({"s": n["id"], "t": d, "k": "대상"})
    last = [nodes[d] for d in stages[-1] if ref(("dataset",), d)]
    by_unit = {}
    for d in last:
        by_unit[d["front"].get("unit", "개")] = by_unit.get(d["front"].get("unit", "개"), 0) + int(d["front"].get("n", 0) or 0)
    data = [{"stage": i, "id": d, "title": nodes[d]["title"] if d in nodes else d, "n": nodes[d]["front"].get("n") if d in nodes else None,
             "unit": nodes[d]["front"].get("unit") if d in nodes else None, "truth": nodes[d]["front"].get("truth") if d in nodes else None}
            for i, st in enumerate(stages) for d in st]

    def chain(text, where):
        if text.strip() == "(없음)":
            return []
        out = []
        for part in text.split("→"):
            part = part.strip()
            if part == "{조건}":
                out.append(("{조건}", [])); continue
            name, ps = parse_el(part)
            if not name or not ref(("step", "tool"), name):
                errs.append(f"{where}: 단계·도구 없음: {part}"); continue
            out.append((name, ps))
            tool = name if nodes[name]["type"] == "tool" else nodes[name]["front"].get("tool")
            if tool:
                edges.append({"s": n["id"], "t": tool, "k": "사용", "v": ", ".join(f"{k}={'|'.join(v)}" for k, v in ps)})
        return out

    frame = chain(val.get("틀", ""), "틀")
    if sum(1 for x, _ in frame if x == "{조건}") != 1:
        errs.append("틀에는 {조건}이 정확히 한 번")
    cond_specs, total = [], 0
    for label, text in conds:
        c = chain(text, f"조건 {label}")
        ex = expand(c); total += len(ex)
        cond_specs.append({"label": label, "text": text, "n": len(ex)})
    metrics = []
    for part in [x.strip() for x in val.get("지표", "").split("·") if x.strip()]:
        name, ps = parse_el(part)
        if not ref(("metric",), name):
            errs.append(f"지표 없음: {part}")
        else:
            edges.append({"s": n["id"], "t": name, "k": "측정"}); metrics.append(name)
    m = re.fullmatch(r"(\w+)(?:\(([^)]*)\))?\.([\w-]+)\s*(=|≥|≤|<|>)\s*(.+)", val.get("기준", ""))
    if not m:
        errs.append("기준 형식은 조건.지표 부등호 값")
    else:
        if m.group(1) not in [c["label"] for c in cond_specs]:
            errs.append(f"기준의 조건 없음: {m.group(1)}")
        if m.group(3) not in metrics:
            errs.append(f"기준의 지표가 지표 줄에 없음: {m.group(3)}")
    for part in [x.strip() for x in val.get("환경", "").split("·") if x.strip()]:
        if not (re.fullmatch(r"[\d.]+h", part) or re.fullmatch(rf"({'|'.join(ENVS)}) × \d+", part)):
            errs.append(f"환경 형식: {part} (kaggle-t4 × 1 · kaggle-cpu × 2 · 10.5h)")
    scale = " + ".join(f"{u} {v:,}개" for u, v in by_unit.items()) + f" × 방법 {total}개"
    seen, uniq = set(), []
    for e in edges:  # 같은 관계는 한 번만 (사용은 변형을 합침)
        key = (e["s"], e["t"], e["k"])
        if key in seen:
            if e.get("v"):
                prev = next(x for x in uniq if (x["s"], x["t"], x["k"]) == key)
                prev["v"] = ", ".join(filter(None, dict.fromkeys([prev.get("v", ""), e["v"]])))
            continue
        seen.add(key); uniq.append(e)
    spec = {"scale": scale, "data": data, "frame": val.get("틀", ""), "conds": cond_specs, "metrics": metrics,
            "pass": val.get("기준", ""), "env": val.get("환경", "")}
    return spec, errs, uniq


def build():
    nodes, edges, warn, tree = {}, [], [], []

    def node(nid, kind, front, body, path):
        if nid in nodes:
            warn.append(f"id 중복: {nid} ({path.relative_to(HERE)})")
        nodes[nid] = {"id": nid, "type": kind, "title": front.get("title", nid), "status": front.get("status"), "kind": front.get("kind"),
                      "meta": {k: v for k, v in front.items() if k in ("license", "where", "n", "unit", "truth", "tool", "better")}, "body": body,
                      "path": str(path.relative_to(HERE)), "front": front}
        return nodes[nid]

    for fdir in sorted(p for p in HERE.iterdir() if p.is_dir() and not p.name.startswith((".", "_"))):
        fp, hp = fdir / "feature.md", fdir / "hypotheses.md"
        f, b = read(fp) if fp.exists() else ({"title": fdir.name}, "")
        node(fdir.name, "feature", f, b, fp if fp.exists() else fdir)
        ftree = {"id": fdir.name, "children": []}
        hid, kids, facts, results = None, [], [], []
        for level, nid, f, b in sections(hp) if hp.exists() else []:
            if level == 2:  # 가설 = 제목
                hid, kids, facts, results = nid, [], [], []
                node(hid, "hypothesis", f, b, hp)
                edges.append({"s": fdir.name, "t": hid, "k": "포함"})
                edges += [{"s": x, "t": hid, "k": "파생"} for x in split_list(f.get("from"))]
                ftree["children"].append({"id": hid, "children": kids})
            elif level == 3 and nid.startswith("experiment-"):  # 실험 본문 마지막 줄 "- 결과: 성공/실패" = 결과 노드
                m = re.search(r"\n?- 결과: (성공|실패)\s*$", b)
                node(nid, "experiment", f, b[:m.start()].strip() if m else b, hp); kids.append({"id": nid})
                edges.append({"s": hid, "t": nid, "k": "검증"})
                edges += [{"s": h, "t": nid, "k": "검증"} for h in split_list(f.get("tests"))]
                if not m:
                    warn.append(f"실험 마지막 줄 '- 결과: 성공 / 실패' 없음: {nid}"); continue
                rid = "result-" + nid[len("experiment-"):]
                node(rid, "result", {"title": m.group(1), "status": {"성공": "success", "실패": "failure"}[m.group(1)]}, "", hp)
                kids.append({"id": rid}); results.append(rid)
                edges.append({"s": nid, "t": rid, "k": "산출"})
            elif level == 4:  # 사실: 같은 가설의 결과가 확정
                node(nid, "fact", f, b, hp); kids.append({"id": nid})
                for rel, lab in (("supports", "지지"), ("refutes", "반박")):
                    edges += [{"s": nid, "t": h, "k": lab} for h in split_list(f.get(rel))]
                edges += [{"s": nid, "t": x, "k": "대상"} for x in split_list(f.get("about"))]
                edges += [{"s": r, "t": nid, "k": "확정"} for r in results]
        tree.append(ftree)
    groups = {"도구": ("_tools", "tool"), "데이터셋": ("_data", "dataset"), "단계": ("_steps", "step"), "지표": ("_metrics", "metric")}
    group = None
    for level, nid, f, b in sections(HERE / "catalog.md"):
        if level == 2:
            group = groups[nid]
            tree.append({"id": group[0], "label": nid, "children": []})
        else:
            node(nid, group[1], f, b, HERE / "catalog.md"); tree[-1]["children"].append({"id": nid})
    for n in nodes.values():  # 단계 → 감싼 도구
        if n["type"] == "step" and n["front"].get("tool"):
            edges.append({"s": n["id"], "t": n["front"]["tool"], "k": "사용"})
    for n in [n for n in nodes.values() if n["type"] == "experiment"]:
        spec, errs, es = parse_experiment(n, nodes)
        n["spec"] = spec; edges += es
        warn += [f"{e}: {n['path']}" for e in errs]
    # 내용 규칙: 가설·사실 = 한 문장(본문 없음), 결과 = 성공/실패만, 실험 = "- 항목: 내용" 목록만(규모 포함)
    for n in nodes.values():
        t, f, b = n["type"], n["front"], n["body"]
        if t in ("hypothesis", "fact", "result") and b:
            warn.append(f"본문이 있으면 안 됨({t}): {n['path']}")
        if t in ("hypothesis", "fact") and len(re.findall(r"[.!?다]\s*$|[.!?]\s+\S", n["title"])) > 1:
            warn.append(f"한 문장이어야 함: {n['path']}")
        if t == "result" and f.get("status") not in ("success", "failure"):
            warn.append(f"결과 status는 success / failure: {n['path']}")
        if t == "fact" and f.get("kind") not in ("성공 요인", "실패 요인", "부수 사실"):
            warn.append(f"사실 kind는 성공 요인 / 실패 요인 / 부수 사실: {n['path']}")
        if t == "experiment" and not re.search(r"(비교|측정|채점)$", n["title"]):
            warn.append(f"실험 제목은 비교 / 측정 / 채점으로 끝남: {n['path']}")
        if t in ("dataset", "step", "metric") and b:
            warn.append(f"본문이 있으면 안 됨({t}): {n['path']}")
    ok = []
    for e in edges:
        (ok if e["s"] in nodes and e["t"] in nodes else warn).append(e if e["s"] in nodes and e["t"] in nodes else f"연결 대상 없음: {e['s']} -{e['k']}-> {e['t']}")
    for n in nodes.values():
        n.pop("front")
    return {"nodes": list(nodes.values()), "edges": ok, "tree": tree}, warn


if __name__ == "__main__":
    g, warn = build()
    print(dict(Counter(n["type"] for n in g["nodes"])), f"관계 {len(g['edges'])}")
    for w in warn:
        print("경고:", w, file=sys.stderr)
