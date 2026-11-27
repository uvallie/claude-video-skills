#!/usr/bin/env python3
"""Quiet lo-fi music bed, synthesised locally (no samples, no licence questions).

    python3 synth_bed.py out.wav --dur 42 [--bpm 84 --seed 1]

Electric-piano chords (Fmaj7 - Em7 - Dm7 - Cmaj7, one per bar, a soft re-hit on the «and» of 3),
sine sub bass on 1 and 3, soft kick, brushed noise snare on 2/4, swung closed hats, everything under a
4.5 kHz low-pass with a little tape wobble. Peak-normalised to -3 dBFS; set the level when mixing.
Needs numpy, scipy, soundfile (see requirements.txt).
"""
import argparse
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]   # F E D C (maj7/m7)
ROOTS = [41, 40, 38, 36]


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def ep_note(f, dur, vel):
    """Rhodes-ish: sine body, a fast-decaying 2nd/3rd harmonic «tine», slow tremolo."""
    t = np.arange(int(dur * SR)) / SR
    body = np.sin(2 * np.pi * f * t)
    tine = 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.25) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.1)
    env = np.minimum(t / 0.008, 1) * np.exp(-t / 1.4)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.2 * t)
    return vel * (body + tine) * env * trem


def kick(vel):
    t = np.arange(int(0.25 * SR)) / SR
    f = 48 + 70 * np.exp(-t / 0.03)
    return vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09)


def noise_hit(rng, dur, tau, lo, hi, vel):
    n = rng.standard_normal(int(dur * SR))
    n = sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), n)
    t = np.arange(len(n)) / SR
    return vel * n * np.exp(-t / tau)


def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    buf[i:i + len(x)] += x


def bed(dur, bpm=84, seed=1):
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    bar = 4 * beat
    n = int((dur + 2) * SR)
    keys, bass, drums = np.zeros(n), np.zeros(n), np.zeros(n)
    nbars = int(np.ceil(dur / bar)) + 1
    for b in range(nbars):
        t0 = b * bar
        ch, root = CHORDS[b % 4], ROOTS[b % 4]
        for hit, vel in ((0.0, 1.0), (2.5 * beat, 0.55)):
            for k, m in enumerate(ch):
                add(keys, ep_note(hz(m), 2.6, vel * 0.25), t0 + hit + k * 0.018)   # gentle strum
        for bt in (0, 2):
            add(bass, ep_note(hz(root), beat * 1.6, 0.5) * 0.9, t0 + bt * beat)
            add(drums, kick(0.55), t0 + bt * beat)
        for bt in (1, 3):
            add(drums, noise_hit(rng, 0.25, 0.06, 900, 5000, 0.10), t0 + bt * beat)
        for e in range(8):
            swing = 0.16 * beat if e % 2 else 0
            add(drums, noise_hit(rng, 0.06, 0.012, 6000, 12000, 0.05 if e % 2 else 0.035), t0 + e * beat / 2 + swing)
    keys = sosfilt(butter(2, 3800, "low", fs=SR, output="sos"), keys)
    bass = sosfilt(butter(2, 220, "low", fs=SR, output="sos"), np.tanh(bass * 1.5))
    mono = keys + bass + drums
    # tape wobble: tiny slow pitch drift via a varying read position
    t = np.arange(n) / SR
    pos = np.clip(t * SR + 0.0006 * SR * np.sin(2 * np.pi * 0.35 * t), 0, n - 1)
    mono = np.interp(pos, np.arange(n), mono)
    mono = sosfilt(butter(2, 4500, "low", fs=SR, output="sos"), mono)
    d = int(0.011 * SR)                              # light width: keys slightly later on the right
    right = mono.copy()
    right[d:] = 0.7 * mono[d:] + 0.3 * mono[:-d]
    st = np.stack([mono, right], axis=1)[: int(dur * SR)]
    return st * (10 ** (-3 / 20) / np.abs(st).max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--dur", type=float, required=True)
    ap.add_argument("--bpm", type=float, default=84)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    sf.write(a.out, bed(a.dur, a.bpm, a.seed), SR, subtype="PCM_16")


if __name__ == "__main__":
    main()
