#!/usr/bin/env python3
"""Render a KEEP list into one file: encode each kept span, then join them without re-encoding.

    python3 cut_edl.py <source video> <keeps.json> <out.mp4> [--crf 20]

keeps.json is [[start, end, label], ...] in seconds (from keeps.py or written by hand).
Parts are cached in .work/edl/<out name>/, so re-running after a small change is fast
(delete the folder if you changed spans in the middle).
"""
import argparse, json, pathlib, shutil, subprocess, sys


def ffmpeg_bin() -> str:
    for p in ("/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg", "/usr/local/opt/ffmpeg-full/bin/ffmpeg"):
        if pathlib.Path(p).exists():
            return p
    return shutil.which("ffmpeg") or sys.exit("ffmpeg not found")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("keeps")
    ap.add_argument("out")
    ap.add_argument("--crf", default="20", help="x264 quality, lower = better")
    ap.add_argument("--preset", default="medium")
    a = ap.parse_args()

    ff = ffmpeg_bin()
    spans = json.loads(pathlib.Path(a.keeps).read_text(encoding="utf-8"))
    work = pathlib.Path.cwd() / ".work" / "edl" / pathlib.Path(a.out).stem
    work.mkdir(parents=True, exist_ok=True)

    parts = []
    for i, span in enumerate(spans):
        s, e = float(span[0]), float(span[1])
        label = span[2] if len(span) > 2 else ""
        part = work / f"part_{i:03d}_{s:.2f}_{e:.2f}.mp4"
        parts.append(part)
        if part.exists() and part.stat().st_size > 0:
            continue
        print(f"[{i + 1}/{len(spans)}] {s:.1f}-{e:.1f} {label[:60]}", flush=True)
        subprocess.run([ff, "-y", "-v", "error", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", a.source,
                        "-c:v", "libx264", "-crf", a.crf, "-preset", a.preset, "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                        "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.02,areverse",   # no clicks at the cuts
                        str(part)], check=True)

    listing = work / "concat.txt"
    listing.write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([ff, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-c", "copy", "-movflags", "+faststart", str(out)], check=True)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
