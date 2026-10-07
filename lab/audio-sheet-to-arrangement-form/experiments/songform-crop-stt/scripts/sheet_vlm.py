# Read sheet-music images with a local MLX vision model -> JSON, then score the extracted
# lyrics against the hand-read reference (refs/lyrics/<id>.txt) with the same CER metric.
# Usage: python sheet_vlm.py <mlx-model-id> [out-subdir]
import json, re, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_cer import semiglobal, norm

ROOT = Path(__file__).resolve().parent.parent
MODEL = sys.argv[1] if len(sys.argv) > 1 else "mlx-community/Qwen3-VL-4B-Instruct-8bit"
OUT = ROOT / "results" / (sys.argv[2] if len(sys.argv) > 2 else "sheet-vlm") / MODEL.split("/")[-1]
OUT.mkdir(parents=True, exist_ok=True)
# teamluke's sheet carries English lyrics only and ongi has no sheet, so neither is comparable
SKIP = {"teamluke_built-together"}

PROMPT = """이 악보 이미지를 읽고 JSON만 출력하세요. 설명 금지.
{"title": "", "key": "", "time_signature": "", "tempo": "", "sections": [{"tag": "", "lyrics": "", "chords": ""}]}
규칙:
- lyrics: 음표 아래 한국어 가사를 자연스러운 문장으로 이어 붙이세요. 음절 사이 하이픈(-)과 공백은 제거합니다.
- tag: 악보에 표시된 구간명(Verse, Chorus, V, C, A, B 등). 표시가 없으면 가사 흐름으로 추정하세요. 마디 번호는 쓰지 마세요.
- chords: 해당 구간의 코드 기호를 순서대로."""

def run(img):
    t = time.time()
    r = subprocess.run([sys.executable, "-m", "mlx_vlm.generate", "--model", MODEL, "--image", str(img),
                        "--prompt", PROMPT, "--max-tokens", "1500", "--temperature", "0"],
                       capture_output=True, text=True)
    return r.stdout, time.time() - t

def parse(txt):
    m = re.search(r"\{.*\}", txt, re.S)
    if not m: return None
    try: return json.loads(m.group(0))
    except Exception: return None

def lyrics_of(d):
    if not d: return ""
    return " ".join(str(s.get("lyrics", "")) for s in d.get("sections", []) if isinstance(s, dict))

songs = {}
for img in sorted((ROOT / "refs/sheets").glob("*")):
    sid = re.sub(r"_\d+$", "", img.stem)
    if sid in SKIP: continue
    out, secs = run(img)
    d = parse(out)
    (OUT / f"{img.stem}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1) if d else out)
    songs.setdefault(sid, {"lyrics": "", "secs": 0.0, "tags": [], "meta": []})
    songs[sid]["lyrics"] += " " + lyrics_of(d)
    songs[sid]["secs"] += secs
    songs[sid]["tags"] += [str(s.get("tag", "")) for s in (d or {}).get("sections", []) if isinstance(s, dict)]
    songs[sid]["meta"].append({k: (d or {}).get(k) for k in ("key", "time_signature", "tempo")})
    print(f"  {img.name}: {secs:.0f}s, parsed={d is not None}", flush=True)

print(f"\n{MODEL}")
print(f"{'song':<26}{'CER':>7}{'sec':>7}  tags")
rows = []
for sid, v in sorted(songs.items()):
    ref = (ROOT / "refs/lyrics" / f"{sid}.txt").read_text()
    r = norm("".join(l for l in ref.splitlines() if not l.strip().startswith(("#", "["))))
    h = norm(v["lyrics"])
    a = semiglobal(h, r)
    cer = min(a[0] / a[1], 3.0) if a else 1.0
    rows.append(cer)
    print(f"{sid:<26}{cer:>7.3f}{v['secs']:>7.0f}  {', '.join(v['tags'][:6])}")
print(f"{'MEAN':<26}{sum(rows)/len(rows):>7.3f}")
json.dump({s: {"cer": c, **{k: v for k, v in songs[s].items() if k != 'lyrics'}} for (s, v), c in zip(sorted(songs.items()), rows)},
          open(OUT / "_summary.json", "w"), ensure_ascii=False, indent=1)
