#!/usr/bin/env python3
"""Convert an SRT into an ASS that uses a style from config/caption_style.ass.

    python3 srt_to_ass.py in.srt out.ass --style Vertical

Styling has to go through a real ASS file rather than ffmpeg's force_style:
ffmpeg's SRT converter assumes a 384x288 script resolution, so font sizes and
margins written for a 1080-wide frame land off-screen.
"""
import argparse, pathlib, re, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
# script resolution each style is authored against
PLAY_RES = {"Vertical": (1080, 1920), "Highlight": (1080, 1920), "Horizontal": (1920, 1080)}

TIME = re.compile(r"(\d+):(\d{2}):(\d{2})[,.](\d{3})")


def ass_ts(t: str) -> str:
    h, m, s, ms = (int(x) for x in TIME.match(t.strip()).groups())
    return f"{h:d}:{m:02d}:{s:02d}.{ms // 10:02d}"


def parse_srt(text: str):
    for block in re.split(r"\n\s*\n", text.replace("\r\n", "\n").strip()):
        lines = [l for l in block.split("\n") if l.strip()]
        if len(lines) < 2:
            continue
        if "-->" not in lines[0]:
            lines = lines[1:]
        if not lines or "-->" not in lines[0]:
            continue
        start, end = lines[0].split("-->")
        yield ass_ts(start), ass_ts(end), "\\N".join(l.strip() for l in lines[1:])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("srt"); ap.add_argument("out")
    ap.add_argument("--style", default="Vertical")
    a = ap.parse_args()

    local = pathlib.Path.cwd() / ".montage" / "caption_style.ass"
    header = (local if local.exists() else SKILL / "config" / "caption_style.ass").read_text(encoding="utf-8")
    if f"Style: {a.style}," not in header:
        print(f"style '{a.style}' not in config/caption_style.ass", file=sys.stderr)
        return 1
    w, h = PLAY_RES.get(a.style, (1080, 1920))
    header = re.sub(r"PlayResX: \d+", f"PlayResX: {w}", header)
    header = re.sub(r"PlayResY: \d+", f"PlayResY: {h}", header)

    events = [f"Dialogue: 0,{s},{e},{a.style},,0,0,0,,{t}"
              for s, e, t in parse_srt(pathlib.Path(a.srt).read_text(encoding="utf-8"))]
    if not events:
        print("no cues parsed from SRT", file=sys.stderr)
        return 1
    pathlib.Path(a.out).write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
