from __future__ import annotations

import argparse
import io
import json
import random
import xml.etree.ElementTree as ET
from pathlib import Path

import cairosvg
import numpy as np
import verovio
from PIL import Image, ImageFilter
from scipy import ndimage


# #
# config

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
TEXT_CLASSES = {"verse", "syl", "harm", "dir", "tempo", "reh", "mNum", "pgHead", "pgFoot", "label", "labelAbbr", "voltaBracket"}  # sets-gt: text
COUNT_CLASSES = ["tie", "slur", "tuplet", "fermata", "dots", "rest", "ledgerLines", "artic", "dynam", "tempo", "graceGrp", "reh", "ending", "verse", "harm"]
SYLLABLES = (
    "주 님 의 사 랑 은 영 원 하 고 나 를 붙 드 시 네 할 렐 루 야 찬 양 해 그 은 혜 로 살 아 가 리 "
    "내 가 주 를 더 욱 사 랑 하 고 우 리 의 맘 을 드 리 니 거 룩 하 신 이 름 높 이 며 를 릴 블 률"
).split()
DIRECTIONS = ["rit.", "a tempo", "Fine", "D.S. al Coda", "To Coda", "섹션", "2nd: 드럼 4비트", "하프타임", "1st: 무난하게", "ALL in", "Key Up", "x2"]
REHEARSALS = ["V", "C", "B", "P", "I", "V1", "C2", "Bridge", "Intro"]
CHORD_KINDS = ["major", "minor", "dominant", "major-seventh", "minor-seventh", "suspended-fourth"]
STEPS = "CDEFGAB"
MUSIC_FONTS = ["Leipzig", "Bravura", "Leland", "Petaluma", "Gootville"]
TEXT_FONTS = ["NanumGothic", "NanumMyeongjo", "NanumBarunGothic", "NanumSquare", "NanumGothic"]
DIGIT_FONTS = ["DejaVu Sans", "DejaVu Serif", "FreeSans", "FreeSerif", "NanumGothic", "NanumMyeongjo", "Carlito", "Caladea"]
DIVISIONS = 12  # per quarter
CELLS = [
    ([12], "note"), ([12], "note"), ([24], "note"), ([6, 6], "beam"), ([6, 6], "beam"), ([18, 6], "dotted"), ([3, 3, 3, 3], "beam16"),
    ([4, 4, 4], "triplet"), ([12], "rest"), ([6], "rest"), ([9, 3], "dotted16"), ([36], "note"), ([48], "note"),
]
NOTE_TYPES = {3: "16th", 4: "eighth", 6: "eighth", 9: "eighth", 12: "quarter", 18: "quarter", 24: "half", 36: "half", 48: "whole"}
DOTTED = {9, 18, 36}
BOOST = {"triplet": 1.0, "triplet_text": 0.0, "triplet_flat": 0.0, "triplet_below": 0.0, "chord_tight": 0.0, "chord_font": 0.0}


# #
# generate

def generate(
    *,
    out: Path,
    start: int,
    count: int,
    boost: dict,
) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for seed in range(start, start + count):
        try:
            image, target, spacing, rng, counts = render(seed=seed, boost=boost)
        except Exception as error:
            # a random score verovio cannot lay out: skip the seed
            print(seed, "fail", type(error).__name__, str(error)[:80], flush=True)
            continue
        degraded, scaled = degrade(
            image=image,
            target=target,
            spacing=spacing,
            rng=rng,
        )
        np.savez_compressed(
            out / f"syn{seed:05d}.npz",
            img=degraded,
            tgt=scaled,
            cnt=json.dumps(counts),
        )
        print(seed, degraded.shape, np.bincount(scaled.ravel(), minlength=3)[:3], flush=True)


# #
# compose

def compose(*, seed: int, boost: dict) -> str:
    rng = random.Random(seed)
    # form
    beats = rng.choice([48, 48, 36])
    fifths = rng.randint(-4, 4)
    measure_count = rng.choice([12, 16, 20, 24])
    verse_count = rng.choice([1, 1, 2, 3])
    low = rng.random() < 0.5  # melody reaching below the staff: ledger lines, ties under the staff
    low_index, high_index = (-3, 8) if low else (1, 12)  # A3..D5 or D4..A5
    index = rng.randint(low_index + 2, high_index - 2)
    repeat_start = rng.randrange(0, measure_count // 2) if rng.random() < 0.6 else None
    repeat_end = rng.randrange(repeat_start + 1, measure_count - 2) if repeat_start is not None else None
    volta = repeat_end is not None and rng.random() < 0.6
    segno_measure = rng.randrange(1, measure_count // 2) if rng.random() < 0.3 else None
    coda_measure = rng.randrange(measure_count // 2, measure_count - 1) if segno_measure is not None and rng.random() < 0.7 else None
    tie_chance, slur_chance, triplet_chance = (
        rng.uniform(0.05, 0.3),
        rng.uniform(0.0, 0.2),
        min(0.25, rng.uniform(0.0, 0.25) * boost["triplet"]),
    )
    measures, tie_carry, open_slur, syllable_index = [], None, False, 0
    for measure in range(measure_count):
        parts = []
        # header
        if measure == 0:
            parts.append(
                f"<attributes><divisions>{DIVISIONS}</divisions><key><fifths>{fifths}</fifths></key>"
                f"<time><beats>{beats // 12}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>"
            )
            if rng.random() < 0.6:
                bpm = rng.choice([64, 68, 72, 76, 80, 96, 120, 140])
                parts.append(
                    f'<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>'
                    f'<per-minute>{bpm}</per-minute></metronome></direction-type><sound tempo="{bpm}"/></direction>'
                )
        # marks
        if rng.random() < 0.15 or (measure == 0 and rng.random() < 0.5):
            parts.append(f'<direction placement="above"><direction-type><rehearsal enclosure="rectangle">{rng.choice(REHEARSALS)}</rehearsal></direction-type></direction>')
        if measure == repeat_start:
            parts.append('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>')
        if volta and measure == repeat_end:
            parts.append('<barline location="left"><ending number="1" type="start">1.</ending></barline>')
        if volta and measure == repeat_end + 1:
            parts.append('<barline location="left"><ending number="2" type="start">2.</ending></barline>')
        if measure == segno_measure:
            parts.append('<direction placement="above"><direction-type><segno/></direction-type></direction>')
        if measure == coda_measure:
            parts.append('<direction placement="above"><direction-type><coda/></direction-type></direction>')
        if rng.random() < 0.12:
            parts.append(f'<direction placement="above"><direction-type><words>{rng.choice(DIRECTIONS)}</words></direction-type></direction>')
        if rng.random() < 0.06:
            parts.append(f'<direction placement="below"><direction-type><dynamics><{rng.choice(["p", "mp", "mf", "f"])}/></dynamics></direction-type></direction>')
        # notes
        left, notes = beats, []
        chord_slots = {0} | ({beats // 2} if rng.random() < 0.5 else set())
        position = 0
        while left > 0:
            cell, kind = rng.choice([
                c for c in CELLS if sum(c[0]) <= left and (c[1] != "triplet" or rng.random() < triplet_chance * 4)
            ])
            for note_index, duration in enumerate(cell):
                inner = []
                if position in chord_slots and rng.random() < 0.85:
                    root = rng.choice(STEPS)
                    chord_kind = rng.choice(CHORD_KINDS)
                    bass = f"<bass><bass-step>{rng.choice(STEPS)}</bass-step></bass>" if rng.random() < 0.2 else ""
                    alter = f"<root-alter>{rng.choice([-1, 1])}</root-alter>" if rng.random() < 0.15 else ""
                    notes.append(f"<harmony><root><root-step>{root}</root-step>{alter}</root><kind>{chord_kind}</kind>{bass}</harmony>")
                is_rest = kind == "rest"
                if not is_rest and rng.random() < 0.02:
                    grace_step, grace_octave, _, _ = pitch(rng=rng, index=index + 1)
                    notes.append(f'<note><grace slash="yes"/><pitch><step>{grace_step}</step><octave>{grace_octave}</octave></pitch><type>eighth</type></note>')
                notations, ties = [], ""
                if is_rest:
                    body = "<rest/>"
                else:
                    if tie_carry is not None:
                        index = tie_carry
                    else:
                        index = max(low_index, min(high_index, index + rng.choice([-2, -1, -1, 0, 1, 1, 2, 3, -3])))
                    step, octave, alter, accidental = pitch(rng=rng, index=index)
                    body = f"<pitch><step>{step}</step>{f'<alter>{alter}</alter>' if alter else ''}<octave>{octave}</octave></pitch>"
                    inner.append(accidental)
                    if tie_carry is not None:
                        ties += '<tie type="stop"/>'
                        notations.append('<tied type="stop"/>')
                    tie_carry = None
                    last = left - duration == 0
                    if rng.random() < tie_chance * (2 if last else 1) and duration >= 6:
                        ties += '<tie type="start"/>'
                        notations.append('<tied type="start"/>')
                        tie_carry = index
                    if open_slur and rng.random() < 0.4:
                        notations.append('<slur type="stop" number="1"/>')
                        open_slur = False
                    elif not open_slur and rng.random() < slur_chance and tie_carry is None:
                        notations.append(f'<slur type="start" number="1" placement="{rng.choice(["above", "below"])}"/>')
                        open_slur = True
                    if rng.random() < 0.03:
                        notations.append("<fermata/>")
                    if rng.random() < 0.04:
                        notations.append(f"<articulations><{rng.choice(['accent', 'staccato', 'tenuto'])}/></articulations>")
                if kind == "triplet":
                    inner.insert(0, "<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>")
                    if note_index == 0:
                        below = boost["triplet_below"] and rng.random() < boost["triplet_below"]
                        notations.append(f'<tuplet type="start" bracket="yes"{' placement="below"' if below else ""}/>')
                    if note_index == 2:
                        notations.append('<tuplet type="stop"/>')
                beam = ""
                if kind in ("beam", "beam16", "triplet", "dotted", "dotted16") and len(cell) > 1 and not is_rest:
                    state = "begin" if note_index == 0 else ("end" if note_index == len(cell) - 1 else "continue")
                    beam = f'<beam number="1">{state}</beam>'
                    if kind == "beam16" or (kind == "dotted16" and note_index == 1):
                        beam += f'<beam number="2">{state if kind == "beam16" else "backward hook"}</beam>'
                lyrics = ""
                if not is_rest and 'tie type="stop"' not in ties:
                    for verse in range(1, verse_count + 1):
                        syllabic = rng.choice(["single", "single", "begin", "middle", "end"])
                        lyrics += f'<lyric number="{verse}"><syllabic>{syllabic}</syllabic><text>{SYLLABLES[(syllable_index + verse * 7) % len(SYLLABLES)]}</text></lyric>'
                    syllable_index += 1
                dot = "<dot/>" if duration in DOTTED else ""
                notation = f"<notations>{''.join(notations)}</notations>" if notations else ""
                notes.append(f"<note>{body}<duration>{duration}</duration>{ties}<type>{NOTE_TYPES[duration]}</type>{dot}{''.join(inner)}{beam}{notation}{lyrics}</note>")
                position += duration if kind != "triplet" else 4
            left -= sum(cell)
        # close
        if measure == measure_count - 1:
            tie_carry = None
            if open_slur:
                for j in range(len(notes) - 1, -1, -1):
                    if notes[j].startswith("<note>") and "<rest/>" not in notes[j]:
                        notes[j] = (
                            notes[j].replace("</note>", '<notations><slur type="stop" number="1"/></notations></note>')
                            if "<notations>" not in notes[j] else notes[j].replace("</notations>", '<slur type="stop" number="1"/></notations>')
                        )
                        break
                open_slur = False
        parts += notes
        # barlines
        if coda_measure and measure == coda_measure - 1:
            parts.append('<direction placement="above"><direction-type><words>To Coda</words></direction-type></direction>')
        if measure == measure_count - 1 and segno_measure is not None:
            parts.append('<direction placement="above"><direction-type><words>D.S. al Coda</words></direction-type></direction>')
        if volta and measure == repeat_end:
            parts.append('<barline location="right"><bar-style>light-heavy</bar-style><ending number="1" type="stop"/><repeat direction="backward"/></barline>')
        elif volta and measure == repeat_end + 1:
            parts.append('<barline location="right"><ending number="2" type="discontinue"/></barline>')
        elif measure == repeat_end:
            parts.append('<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>')
        elif measure == measure_count - 1:
            parts.append('<barline location="right"><bar-style>light-heavy</bar-style></barline>')
        measures.append(f'<measure number="{measure + 1}">{"".join(parts)}</measure>')
    # score
    title = "".join(rng.choice(SYLLABLES) for _ in range(rng.randint(3, 8)))
    composer = "".join(rng.choice(SYLLABLES) for _ in range(3))
    return (
        '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1">'
        f'<work><work-title>{title}</work-title></work>'
        f'<identification><creator type="composer">{composer} 작곡</creator></identification>'
        '<part-list><score-part id="P1"><part-name></part-name></score-part></part-list>'
        f'<part id="P1">{"".join(measures)}</part></score-partwise>'
    )


def pitch(*, rng: random.Random, index: int) -> tuple[str, int, int, str]:
    step, octave = STEPS[index % 7], 4 + index // 7  # index: scale degree, 0 = C4
    alter, accidental = 0, ""
    if rng.random() < 0.05:
        alter = rng.choice([-1, 1])
        accidental = f"<accidental>{'flat' if alter < 0 else 'sharp'}</accidental>"
    return step, octave, alter, accidental


# #
# render

def render(*, seed: int, boost: dict) -> tuple[np.ndarray, np.ndarray, float, random.Random, dict]:
    rng = random.Random(seed * 7 + 1)
    # layout
    toolkit = verovio.toolkit()
    toolkit.setOptions({
        "pageWidth": rng.choice([1900, 2100, 2300]), "pageHeight": 2970, "scale": 50, "adjustPageHeight": True,
        "footer": "none", "header": "auto", "breaks": "auto", "font": rng.choice(MUSIC_FONTS),
        "mnumInterval": rng.choice([0, 0, 1, 4]), "lyricSize": rng.uniform(3.0, 5.0),
        "spacingSystem": rng.uniform(10, 18), "staffLineWidth": rng.uniform(0.1, 0.3), "stemWidth": rng.uniform(0.15, 0.35),
    })
    toolkit.loadData(compose(seed=seed, boost=boost))
    svg = toolkit.renderToSVG(1).replace('font-family="Times, serif"', f'font-family="{rng.choice(TEXT_FONTS)}"')
    # only Leipzig is installed as a system font: text-embedded SMuFL glyphs (metronome note) fall back to it
    for font in MUSIC_FONTS:
        svg = (
            svg
            .replace(f"font-family='{font}'", "font-family='Leipzig'")
            .replace(f'font-family="{font}"', 'font-family="Leipzig"')
        )
    root = ET.fromstring(svg)
    # count
    counts = {name: 0 for name in COUNT_CLASSES}
    for group in root.iter(f"{{{SVG}}}g"):
        name = _first_class(group)
        if name in counts: counts[name] += 1
    # vary
    restyle_tuplets(root=root, rng=rng, boost=boost)
    restyle_chords(root=root, rng=rng, boost=boost)
    # rasterize
    zoom = 1.6
    image = np.asarray(
        rasterize(root=root, zoom=zoom).convert("L")
    )
    for group in root.iter(f"{{{SVG}}}g"):
        if _first_class(group) not in TEXT_CLASSES: continue
        for key in ("fill", "stroke", "color"): group.set(key, "#ff0000")
        for child in group.iter():
            for key in ("fill", "stroke"):
                if child is not group and child.get(key) not in (None, "none"): child.set(key, "#ff0000")
    colored = np.asarray(
        rasterize(root=root, zoom=zoom)
    ).astype(int)
    # label
    # anti-aliased thin strokes are pinkish, not pure red
    red = (colored[..., 0] - colored[..., 1] > 40) & (colored[..., 0] - colored[..., 2] > 40)
    ink = image < 200
    text = ink & ndimage.binary_dilation(input=red, iterations=1)
    target = np.where(text, 1, np.where(ink, 2, 0)).astype(np.uint8)
    spacing = measure_spacing(image=image)
    return image, target, spacing, rng, counts


def restyle_tuplets(*, root: ET.Element, rng: random.Random, boost: dict) -> None:
    for group in root.iter(f"{{{SVG}}}g"):
        name = _first_class(group)
        # digit from a text font, still a symbol
        if name == "tupletNum" and boost["triplet_text"] and rng.random() < boost["triplet_text"]:
            for use in list(group):
                x, y = map(float, use.get("transform").split("(")[1].split(")")[0].split(","))
                group.remove(use)
                digit = ET.SubElement(group, f"{{{SVG}}}text", {
                    "x": str(x), "y": str(y), "font-size": f"{rng.uniform(260, 420):.0f}px",
                    "font-family": rng.choice(DIGIT_FONTS), "font-style": rng.choice(["normal", "italic"]),
                    "font-weight": rng.choice(["normal", "bold"]),
                })
                digit.text = "3"
        # flat bracket, as on most worship sheets
        if name == "tupletBracket" and boost["triplet_flat"] and rng.random() < boost["triplet_flat"]:
            polylines = [child for child in group if child.tag.endswith("polyline")]
            points = [[tuple(map(float, pair.split(","))) for pair in line.get("points").split()] for line in polylines]
            if len(points) == 2 and all(len(line) == 3 for line in points):
                level = sum(line[2][1] for line in points) / 2
                for line, (corner, hook, end) in zip(polylines, points):
                    depth = corner[1] - hook[1]
                    line.set("points", f"{corner[0]},{level + depth} {corner[0]},{level} {end[0]},{level}")


def restyle_chords(*, root: ET.Element, rng: random.Random, boost: dict) -> None:
    tight = boost["chord_tight"] and rng.random() < boost["chord_tight"]
    fonted = boost["chord_font"] and rng.random() < boost["chord_font"]
    if fonted: font, weight, scale = rng.choice(DIGIT_FONTS), rng.choice(["normal", "bold"]), rng.uniform(0.7, 1.15)
    for measure in root.iter(f"{{{SVG}}}g"):
        if _first_class(measure) != "measure": continue
        staves = [child for child in measure if _first_class(child) == "staff"]
        lines = [float(child.get("d").split()[1]) for child in staves[0] if child.tag.endswith("path")] if staves else []
        for harmony in measure:
            if _first_class(harmony) != "harm": continue
            for text in harmony.iter(f"{{{SVG}}}text"):
                if tight and len(lines) == 5:
                    text.set("y", f"{min(lines) - rng.uniform(0.5, 2.0) * (lines[1] - lines[0]):.0f}")
                if fonted:
                    text.set("font-family", font)
                    text.set("font-weight", weight)
                    for span in text.iter():
                        size = span.get("font-size") or "0px"
                        if size != "0px": span.set("font-size", f"{float(size[:-2]) * scale:.0f}px")


def rasterize(*, root: ET.Element, zoom: float) -> Image.Image:
    png = cairosvg.svg2png(bytestring=ET.tostring(root), scale=zoom, background_color="white")
    return Image.open(io.BytesIO(png)).convert("RGB")


def measure_spacing(*, image: np.ndarray) -> float:
    # the verovio unit depends on the scale: read the staff spacing off the 5-line runs
    rows = (image < 160).sum(1) > 0.4 * image.shape[1]
    tops = [y for y in range(1, len(rows)) if rows[y] and not rows[y - 1]]
    gaps = np.diff(tops)
    gaps = gaps[(gaps > 3) & (gaps < 60)]
    spacing = float(np.median(gaps)) if len(gaps) else 18.0
    return spacing


def _first_class(element: ET.Element) -> str | None:
    names = (element.get("class") or "").split()
    return names[0] if names else None


# #
# degrade

def degrade(
    *,
    image: np.ndarray,
    target: np.ndarray,
    spacing: float,
    rng: random.Random,
) -> tuple[np.ndarray, np.ndarray]:
    # scale
    factor = rng.uniform(7, 17) / spacing  # staff spacing of the half-resolution real pages
    height, width = image.shape
    size = (max(64, round(width * factor)), max(64, round(height * factor)))
    picture = Image.fromarray(image).resize(size, Image.LANCZOS)
    scaled = Image.fromarray(target).resize(size, Image.NEAREST)
    # resolution
    # a low-resolution original enlarged by the publisher or by us
    if rng.random() < 0.5:
        shrink = rng.uniform(0.4, 0.8)
        small = (max(32, round(size[0] * shrink)), max(32, round(size[1] * shrink)))
        picture = (
            picture
            .resize(small, Image.BILINEAR)
            .resize(size, Image.BILINEAR)
        )
    if rng.random() < 0.3:
        picture = picture.filter(
            ImageFilter.GaussianBlur(rng.uniform(0.3, 0.9))
        )
    # print
    # faded or gray prints
    pixels = np.asarray(picture).astype(np.float32)
    ink_level, paper = rng.uniform(0, 140), rng.uniform(225, 255)
    pixels = paper - (255 - pixels) / 255 * (paper - ink_level)
    if rng.random() < 0.4:
        noise = np.random.default_rng(rng.randrange(1 << 30))
        pixels += noise.normal(
            0,
            rng.uniform(2, 10),
            pixels.shape,
        )
    pixels = np.clip(pixels, 0, 255).astype(np.uint8)
    # jpeg
    if rng.random() < 0.5:
        buffer = io.BytesIO()
        Image.fromarray(pixels).save(
            fp=buffer,
            format="JPEG",
            quality=rng.randint(30, 90),
        )
        pixels = np.asarray(
            Image.open(buffer).convert("L")
        )
    return pixels, np.asarray(scaled)


# #
# cli

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--boost", type=json.loads, default={})
    arguments = parser.parse_args()
    generate(
        out=arguments.out,
        start=arguments.start,
        count=arguments.count,
        boost={**BOOST, **arguments.boost},
    )
