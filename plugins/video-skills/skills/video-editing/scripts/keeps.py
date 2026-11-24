#!/usr/bin/env python3
"""Build a KEEP list (what stays in the edit) from a word-timed transcript.

    python3 keeps.py .work/transcripts/clip.json [--gap 0.6] [--pad 0.12] [--drop "ну,ееее,ммм"] [--out keeps.json]

Cuts every pause longer than --gap seconds and, optionally, filler words listed in --drop.
Writes [[start, end, "text of the span"], ...] in seconds. Edit the JSON by hand (or ask Claude) to
drop whole sentences, then render with cut_edl.py.
"""
import argparse, json, pathlib, re


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript", help=".json written by transcribe.py")
    ap.add_argument("--gap", type=float, default=0.6, help="cut pauses longer than this (s)")
    ap.add_argument("--pad", type=float, default=0.12, help="breathing room kept around speech (s)")
    ap.add_argument("--drop", default="", help="comma-separated filler words to cut")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    src = pathlib.Path(a.transcript)
    drop = {w.strip().lower() for w in a.drop.split(",") if w.strip()}
    norm = lambda w: re.sub(r"[^\w'ʼ-]", "", w.lower())
    words = [w for seg in json.loads(src.read_text(encoding="utf-8")) for w in seg.get("words", [])]
    words = [w for w in words if norm(w["word"]) and norm(w["word"]) not in drop]
    if not words:
        print("no words in transcript")
        return 1

    spans, cur = [], [words[0]]
    for w in words[1:]:
        if w["start"] - cur[-1]["end"] > a.gap:
            spans.append(cur); cur = []
        cur.append(w)
    spans.append(cur)

    keeps = []
    for s in spans:
        start = max(0.0, s[0]["start"] - a.pad)
        end = s[-1]["end"] + a.pad
        if keeps and start <= keeps[-1][1]:            # padding overlapped the previous span: merge
            keeps[-1][1] = end
            keeps[-1][2] += " " + " ".join(w["word"].strip() for w in s)
        else:
            keeps.append([round(start, 3), round(end, 3), " ".join(w["word"].strip() for w in s)])

    total = words[-1]["end"]
    kept = sum(e - s for s, e, _ in keeps)
    out = pathlib.Path(a.out or src.with_suffix(".keeps.json"))
    out.write_text(json.dumps(keeps, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{out}: {len(keeps)} spans, {kept:.1f}s of {total:.1f}s kept ({total - kept:.1f}s of pauses cut)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
