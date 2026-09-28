# Usage: python raw_table.py <mix.json> <stems.json> <segments.w180.json> [segments.w420.json]
# Prints raw model output as a markdown table (no grading).
import json, sys
mix, stems = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
b = mix["bpm"]
print(f"- BPM {b['value']} (alt {b['alternates']}), beats/bar {b['meter_beats_per_bar']}, ibi_cv {b['ibi_cv']}, tuning {mix['tuning_offset']}")
print(f"- song key (Essentia majority): mix {mix['key']['song_key_essentia_majority']} / stems {stems['key']['song_key_essentia_majority']}")
print(f"- timing mix {mix['timing_s']} / stems {stems['timing_s']}\n")
print("| label | start–end | bpm | Essentia mix | str | CNN mix | Essentia stems | CNN stems | OTI mix/stems |\n|---|---|---|---|---|---|---|---|---|")
for a, s in zip(mix["sections"], stems["sections"]):
    oti = f"{a.get('oti_vs_first_chorus','')} / {s.get('oti_vs_first_chorus','')}" if "oti_vs_first_chorus" in a else ""
    print(f"| {a['label']} | {a['start']}–{a['end']} | {a['bpm']} | {a.get('key_essentia','-')} | {a.get('strength','')} | {a.get('key_cnn','-')} | {s.get('key_essentia','-')} | {s.get('key_cnn','-')} | {oti} |")
for f in sys.argv[3:]:
    print(f"\n{f.rsplit('/',1)[-1]}: " + " · ".join(f"{x['label']}({x['start']:.1f})" for x in json.load(open(f))))
