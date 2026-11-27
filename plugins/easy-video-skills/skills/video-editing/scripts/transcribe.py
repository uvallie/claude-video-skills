#!/usr/bin/env python3
"""Transcribe a video/audio file and write SRT, VTT and a word-highlight ASS.

    python3 transcribe.py "Сирі відео/clip.mp4" --lang uk [--model large-v3] [--out .work/transcripts]

Writes <out>/<name>.srt, .vtt, .txt, .json (word timings) and .ass (word-highlight captions).
Needs: pip install -r requirements.txt (faster-whisper). Runs locally, no API key.
"""
import argparse, json, pathlib, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent


def caption_header():
    local = pathlib.Path.cwd() / ".montage" / "caption_style.ass"
    return (local if local.exists() else SKILL / "config" / "caption_style.ass").read_text(encoding="utf-8")


def ts(seconds: float, sep: str = ",") -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def ass_ts(seconds: float) -> str:
    cs = int(round(seconds * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def chunk_words(words, max_words, max_chars):
    """Group word timings into short caption cues that fit a vertical frame."""
    cue, cues = [], []
    for w in words:
        cue.append(w)
        text = " ".join(x.word.strip() for x in cue)
        if len(cue) >= max_words or len(text) >= max_chars or w.word.strip().endswith((".", "!", "?")):
            cues.append(cue)
            cue = []
    if cue:
        cues.append(cue)
    return cues


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("--lang", default=None, help="uk, en, ... (auto-detect if omitted)")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--style", default="Vertical", help="style name from config/caption_style.ass")
    ap.add_argument("--out", default=".work/transcripts")
    ap.add_argument("--max-words", type=int, default=4)
    ap.add_argument("--max-chars", type=int, default=22)
    args = ap.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("install deps first:  pip install faster-whisper", file=sys.stderr)
        return 1

    name = pathlib.Path(args.media).stem
    model = WhisperModel(args.model, device="auto", compute_type="auto")
    segments, info = model.transcribe(args.media, language=args.lang, word_timestamps=True, vad_filter=True)
    segments = list(segments)
    print(f"language={info.language} duration={info.duration:.1f}s")

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    srt = out / f"{name}.srt"
    with srt.open("w", encoding="utf-8") as f:
        for i, s in enumerate(segments, 1):
            f.write(f"{i}\n{ts(s.start)} --> {ts(s.end)}\n{s.text.strip()}\n\n")

    with (out / f"{name}.vtt").open("w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for s in segments:
            f.write(f"{ts(s.start, '.')} --> {ts(s.end, '.')}\n{s.text.strip()}\n\n")

    (out / f"{name}.txt").write_text(
        " ".join(s.text.strip() for s in segments), encoding="utf-8")
    (out / f"{name}.json").write_text(json.dumps(
        [{"start": s.start, "end": s.end, "text": s.text,
          "words": [{"start": w.start, "end": w.end, "word": w.word} for w in (s.words or [])]}
         for s in segments], ensure_ascii=False, indent=2), encoding="utf-8")

    # Word-highlight (karaoke) ASS on top of the shared style header.
    header = caption_header()
    words = [w for s in segments for w in (s.words or [])]
    lines = []
    for cue in chunk_words(words, args.max_words, args.max_chars):
        start, end = cue[0].start, cue[-1].end
        body = ""
        for w in cue:
            word = w.word.strip()
            if body and word[:1] in "'ʼ’-":           # Whisper splits «пов'язати», «AI-агент» into two tokens
                body = body.rstrip()
            body += f"{{\\k{max(1, int(round((w.end - w.start) * 100)))}}}{word} "
        lines.append(f"Dialogue: 0,{ass_ts(start)},{ass_ts(end)},{args.style},,0,0,0,,{body.strip()}")
    (out / f"{name}.ass").write_text(
        header + "\n".join(lines) + "\n", encoding="utf-8")

    print(f"wrote {srt} (+ .vtt .txt .json .ass)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
