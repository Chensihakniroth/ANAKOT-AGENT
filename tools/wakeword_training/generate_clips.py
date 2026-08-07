"""Generate the "hey casca" training dataset: TTS positives + speech/noise negatives.

Positives:  "Hey Casca." across 12 edge-tts voices x {rate,pitch} variants,
            then ffmpeg pitch/rate augmentation + noise mixing.
Negatives:  random sentences + phonetically-confusable phrases x 4 voices,
            plus synthesized noise clips.
All clips:  16 kHz mono int16 wav, exactly 2.0s (32000 samples) — yields
            exactly 16 embedding frames for the (16, 96) model input.
Split:      85% train / 15% val per class.
"""
import asyncio
import os
import random
import subprocess
import sys

import edge_tts
import numpy as np
import soundfile as sf

SCRATCH = os.environ.get("WAKEWORD_TRAIN_ROOT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_data"))
RAW = os.path.join(SCRATCH, "clips_raw")
OUT = os.path.join(SCRATCH, "hey_casca_data")
SR = 16000
CLIP = 32000  # 2.0 s

random.seed(7)
np.random.seed(7)

POS_VOICES = [
    "en-US-AriaNeural", "en-US-JennyNeural", "en-US-GuyNeural",
    "en-US-ChristopherNeural", "en-US-EricNeural", "en-US-MichelleNeural",
    "en-US-AnaNeural", "en-GB-SoniaNeural", "en-GB-RyanNeural",
    "en-AU-NatashaNeural", "en-CA-ClaraNeural", "en-IN-NeerjaNeural",
]
NEG_VOICES = [
    "en-US-AriaNeural", "en-US-GuyNeural",
    "en-GB-SoniaNeural", "en-AU-NatashaNeural",
]

POS_VARIANTS = [
    {}, {"rate": "+18%"}, {"rate": "-12%"}, {"pitch": "+18Hz"}, {"pitch": "-18Hz"},
]
POS_EXTRA = [  # extra phrasings on 3 voices
    ("en-US-AriaNeural", "Hey Casca!", {}),
    ("en-US-AriaNeural", "Hey Casca?", {}),
    ("en-US-GuyNeural", "Hey Casca!", {}),
    ("en-US-JennyNeural", "Hey Casca?", {}),
    ("en-US-GuyNeural", "Hey Casca.", {"rate": "+10%"}),
    ("en-US-JennyNeural", "Hey Casca.", {"pitch": "+10Hz"}),
]

CONFUSABLE = [
    "hey casta", "hey casco", "hey carlos", "hey pasta", "hey gasca",
    "hey kostas", "hey castle", "okay casca", "cascara", "casino",
    "the casca system", "casca is the assistant", "hey casca? no", "casta",
    "hey cass", "hey carla", "hey carol", "hey gas can", "hey casket",
    "kay, cast a vote", "hey kazakh", "hey cascade", "hey cash cow", "hey cascata",
]

SENTENCES = [
    "What time is the meeting tomorrow?",
    "I need to finish this report before lunch.",
    "The weather is beautiful outside today.",
    "Please remind me to call the doctor.",
    "How does this new feature work?",
    "Let's grab coffee after the presentation.",
    "The server is down and we need to restart it.",
    "I left my keys on the kitchen counter.",
    "Can you send me the file by email?",
    "The traffic was terrible this morning.",
    "We should review the code before merging.",
    "My favorite movie is playing at the theater.",
    "The dog is sleeping on the couch again.",
    "Open the window, it's getting hot in here.",
    "I'll book the flight for next Tuesday.",
    "Remember to water the plants while I'm away.",
    "The new update fixes several bugs.",
    "She works at the hospital downtown.",
    "Let's walk to the park after dinner.",
    "The printer is out of paper again.",
    "I can't find my glasses anywhere.",
    "Breakfast is the most important meal.",
    "We need more milk and eggs from the store.",
    "The concert starts at eight tonight.",
    "He drives a blue pickup truck.",
    "Turn down the music, please.",
    "The wifi keeps disconnecting in my room.",
    "I'm learning to play the guitar.",
    "That restaurant has the best pizza in town.",
    "The package should arrive by Friday.",
    "Don't forget your umbrella, it might rain.",
    "The kids are playing in the backyard.",
    "I have an appointment at three o'clock.",
    "This coffee is way too strong.",
    "The battery on my phone is almost dead.",
    "We're going camping next weekend.",
    "The meeting was rescheduled to Monday.",
    "I need to renew my passport soon.",
    "The cake is in the oven right now.",
    "He teaches math at the high school.",
]

HARD_TEXTS = [  # expanded v4 pool: full CONFUSABLE family + mined adversarials
    # --- confusables containing the word itself (fires in ALL voices in v3) ---
    "okay casca", "hey casca? no", "casca is the assistant", "the casca system",
    "hi casca", "yo casca", "hey, casca", "casca hey", "sorry casca", "thanks casca",
    "good morning casca", "casca", "okay casca okay",
    # --- phonetic near-misses (v3 firers + mined) ---
    "hey pasta", "hey kostas", "hey cass", "hey carol", "hey gas can", "hey casket",
    "hey castle", "hey casta", "hey casco", "hey carlos", "hey gasca", "hey carla",
    "hey cascade", "hey cash cow", "hey cascata", "hey kazakh", "kay, cast a vote",
    "hey caster", "hey cast", "hey classic", "hey kasha", "hey kaska", "hey cassie",
    "hey cassia", "hey cassandra", "hey kat", "hey catch", "hey ketchup", "hey mask",
    "hey gas mask", "hey cat scan", "hey ask her", "he asked her",
    "he asked her to come", "hey carriage", "hey captain", "hey kara", "hey kerry",
    "hey kaz", "hey cactus", "hey kazoo", "massacre", "hey costco", "hey kestrel",
    "hey casserole", "hey cast iron", "hey classic car", "hey gas canister",
    "hey castaway", "hey kazakhstan", "hey, pass the ketchup", "hey, that's a classic",
    "hey, grab a mask", "where is casca",
]
HARD_VARIANTS = [{}, {"rate": "+18%"}, {"pitch": "+18Hz"}, {"pitch": "-18Hz"}]

FFMPEG = "ffmpeg"


def ffmpeg_wav(mp3_path, wav_path):
    subprocess.run(
        [FFMPEG, "-y", "-i", mp3_path, "-ac", "1", "-ar", str(SR), wav_path],
        capture_output=True, check=True)


def pitch_rate_variant(wav_in, wav_out, semitones=0, rate=1.0, volume_db=0.0):
    """Pitch shift (semitones, duration-preserving) + tempo rate + volume."""
    vf = []
    if semitones:
        k = 2.0 ** (semitones / 12.0)
        vf.append(f"asetrate={SR}*{k:.5f},aresample={SR},atempo={1/k:.5f}")
    if rate != 1.0:
        vf.append(f"atempo={rate:.4f}")
    if volume_db:
        vf.append(f"volume={volume_db:.1f}dB")
    filt = ",".join(vf) if vf else "anull"
    subprocess.run(
        [FFMPEG, "-y", "-i", wav_in, "-af", filt, "-ac", "1", "-ar", str(SR), wav_out],
        capture_output=True, check=True)


async def synth(text, voice, wav_path, rate=None, pitch=None):
    mp3 = wav_path + ".mp3"
    kwargs = {}
    if rate:
        kwargs["rate"] = rate
    if pitch:
        kwargs["pitch"] = pitch
    await edge_tts.Communicate(text, voice, **kwargs).save(mp3)
    ffmpeg_wav(mp3, wav_path)
    os.remove(mp3)


async def synth_many(jobs, wav_dir, sem=5):
    """jobs: list of (name, text, voice, {rate,pitch}). Writes {wav_dir}/{name}.wav"""
    os.makedirs(wav_dir, exist_ok=True)
    lim = asyncio.Semaphore(sem)

    async def one(job):
        name, text, voice, kwargs = job
        path = os.path.join(wav_dir, name + ".wav")
        if os.path.exists(path):
            return
        async with lim:
            for attempt in range(3):
                try:
                    await synth(text, voice, path, **kwargs)
                    return
                except Exception as e:
                    if attempt == 2:
                        print(f"  FAIL {name}: {e}")
                    else:
                        await asyncio.sleep(1.5 * (attempt + 1))

    await asyncio.gather(*(one(j) for j in jobs))


def load_pad(wav_path, n=CLIP, lead_in=0.0):
    """Read wav; pad/truncate to n samples; lead_in = seconds of silence prefix."""
    x, sr = sf.read(wav_path, dtype="int16")
    if sr != SR:
        raise ValueError(f"unexpected sr {sr} in {wav_path}")
    lead = int(lead_in * SR)
    if len(x) + lead > n:
        x = x[: n - lead] if n - lead > 0 else x[:n]
        x = np.concatenate([np.zeros(min(lead, n), dtype=np.int16), x[: max(0, n - min(lead, n))]])
        return x[:n]
    return np.concatenate([np.zeros(lead, dtype=np.int16), x, np.zeros(n - lead - len(x), dtype=np.int16)])


def mix_noise(x, snr_db, seed=None):
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 1, len(x)).astype(np.float32)
    sig_pow = np.mean(x.astype(np.float32) ** 2) + 1e-12
    noi_pow = np.mean(noise ** 2) + 1e-12
    scale = np.sqrt(sig_pow / (noi_pow * 10 ** (snr_db / 10)))
    mixed = x.astype(np.float32) + noise * scale
    peak = np.max(np.abs(mixed))
    if peak > 32767:
        mixed = mixed * (32767 / peak)
    return mixed.astype(np.int16)


def synth_positives():
    print("== synthesizing positives ==")
    jobs = []
    i = 0
    for voice in POS_VOICES:
        for v in POS_VARIANTS:
            jobs.append((f"pos_base_{i:03d}", "Hey Casca.", voice, v))
            i += 1
    for voice, text, v in POS_EXTRA:
        jobs.append((f"pos_base_{i:03d}", text, voice, v))
        i += 1
    asyncio.run(synth_many(jobs, os.path.join(RAW, "pos")))
    print(f"  {len(jobs)} positive base clips")


def synth_negatives():
    print("== synthesizing negatives ==")
    jobs = []
    i = 0
    for sent in SENTENCES:
        for voice in NEG_VOICES:
            jobs.append((f"neg_s_{i:03d}", sent, voice, {}))
            i += 1
    i = 0
    for phrase in CONFUSABLE:
        for voice in NEG_VOICES:
            jobs.append((f"neg_c_{i:03d}", phrase, voice, {}))
            i += 1
    asyncio.run(synth_many(jobs, os.path.join(RAW, "neg")))
    print(f"  {len(jobs)} negative base clips")


def synth_hard():
    """Synthesize hard negatives: confusable phrases across 4 voices.

    TTS only the BASE (text x voice, no variants) to cut network calls 4x;
    rate/pitch variants are derived locally with ffmpeg. 10% holdout for
    validation lives in the trainer (hard vs hard_t split on filenames).
    """
    print("== synthesizing hard negatives ==")
    raw_dir = os.path.join(RAW, "hard")
    jobs = []
    for text in HARD_TEXTS:
        for voice in NEG_VOICES:
            jobs.append((f"hb_{len(jobs):03d}", text, voice, {}))
    asyncio.run(synth_many(jobs, raw_dir))
    print(f"  {len(jobs)} hard BASE clips (TTS)")

    out_dir = os.path.join(OUT, "hard_negatives")
    os.makedirs(out_dir, exist_ok=True)
    rng = random.Random(11)
    idx = 0
    tmp = os.path.join(SCRATCH, "tmp_hard.wav")
    for f in sorted(x for x in os.listdir(raw_dir) if x.endswith(".wav")):
        base = load_pad(os.path.join(raw_dir, f), lead_in=rng.uniform(0.1, 0.4))
        sf.write(tmp, base, SR, subtype="PCM_16")
        for v in HARD_VARIANTS:
            if not v:
                x = base
            else:
                out = os.path.join(SCRATCH, "tmp_hard2.wav")
                kw = {}
                if "rate" in v:
                    kw["rate"] = 1.0 + 0.18
                if "pitch" in v:
                    kw["semitones"] = 3 if "+" in v["pitch"] else -3
                pitch_rate_variant(tmp, out, **kw)
                x = load_pad(out, lead_in=rng.uniform(0.1, 0.4))
            sf.write(os.path.join(out_dir, f"h_{idx:03d}.wav"), x, SR, subtype="PCM_16")
            idx += 1
        if idx % 3 == 0:
            sf.write(os.path.join(out_dir, f"h_{idx:03d}.wav"),
                     mix_noise(base, rng.uniform(12, 22), seed=idx), SR, subtype="PCM_16")
            idx += 1
    print(f"  {idx} hard negative clips -> {out_dir}")


def main():
    os.makedirs(RAW, exist_ok=True)

    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    if stage not in ("all", "pos", "neg", "hard", "assemble"):
        print(f"unknown stage {stage!r} (use pos|neg|hard|assemble|all)")
        return
    if stage in ("all", "pos"):
        synth_positives()
    if stage in ("all", "neg"):
        synth_negatives()
    if stage in ("all", "hard"):
        synth_hard()
    if stage in ("all", "assemble"):
        assemble()


def assemble():
    pos_dir = os.path.join(RAW, "pos")
    neg_dir = os.path.join(RAW, "neg")

    pos_files = sorted(f for f in os.listdir(pos_dir) if f.endswith(".wav"))
    neg_files = sorted(f for f in os.listdir(neg_dir) if f.endswith(".wav"))
    print(f"base positives={len(pos_files)} negatives={len(neg_files)}")

    def out_dirs():
        return {k: os.path.join(OUT, k) for k in
                ["positive_train", "positive_test", "negative_train", "negative_test"]}

    dirs = out_dirs()
    for d in dirs.values():
        os.makedirs(d, exist_ok=True)

    # shuffle + 85/15 split
    rng = random.Random(11)
    rng.shuffle(pos_files)
    rng.shuffle(neg_files)
    n_pos_test = max(1, int(0.15 * len(pos_files)))
    n_neg_test = max(1, int(0.15 * len(neg_files)))
    pos_train, pos_test = pos_files[n_pos_test:], pos_files[:n_pos_test]
    neg_train, neg_test = neg_files[n_neg_test:], neg_files[:n_neg_test]

    def write_clip(x, path):
        sf.write(path, x, SR, subtype="PCM_16")

    # positives: lead-in silence 0.25-0.6s, then augmentation variants
    print("== building positive set (with augmentation) ==")
    idx = 0
    for f in pos_train:
        base = load_pad(os.path.join(pos_dir, f), lead_in=rng.uniform(0.25, 0.6))
        write_clip(base, os.path.join(dirs["positive_train"], f"p_{idx:04d}.wav"))
        idx += 1
        # variants on a subset
        if idx % 2 == 0:
            tmp = os.path.join(SCRATCH, "tmp_var.wav")
            sf.write(tmp, base, SR, subtype="PCM_16")
            for label, kw in [("pitch_up", {"semitones": 3}), ("pitch_dn", {"semitones": -3}),
                              ("rate_fast", {"rate": 1.1}), ("rate_slow", {"rate": 0.9})]:
                out = os.path.join(SCRATCH, "tmp_var2.wav")
                pitch_rate_variant(tmp, out, **kw)
                x = load_pad(out, lead_in=rng.uniform(0.25, 0.6))
                write_clip(x, os.path.join(dirs["positive_train"], f"p_{idx:04d}.wav"))
                idx += 1
            # noise-mixed variant
            x = mix_noise(base, rng.uniform(15, 25), seed=idx)
            write_clip(x, os.path.join(dirs["positive_train"], f"p_{idx:04d}.wav"))
            idx += 1
    for f in pos_test:
        write_clip(load_pad(os.path.join(pos_dir, f), lead_in=rng.uniform(0.25, 0.6)),
                   os.path.join(dirs["positive_test"], f"p_{idx:04d}.wav"))
        idx += 1

    # negatives: pad/truncate; some with noise
    print("== building negative set ==")
    idx = 0
    for f in neg_train:
        base = load_pad(os.path.join(neg_dir, f))
        write_clip(base, os.path.join(dirs["negative_train"], f"n_{idx:04d}.wav"))
        idx += 1
        if idx % 3 == 0:
            write_clip(mix_noise(base, rng.uniform(12, 20), seed=idx),
                       os.path.join(dirs["negative_train"], f"n_{idx:04d}.wav"))
            idx += 1
    for f in neg_test:
        write_clip(load_pad(os.path.join(neg_dir, f)),
                   os.path.join(dirs["negative_test"], f"n_{idx:04d}.wav"))
        idx += 1

    # pure noise negatives (train only)
    print("== adding noise negatives ==")
    for n in range(24):
        color = rng.choice(["white", "pink", "brown"])
        amp = rng.uniform(0.02, 0.12)
        out = os.path.join(dirs["negative_train"], f"noise_{n:03d}.wav")
        subprocess.run(
            [FFMPEG, "-y", "-f", "lavfi", "-i",
             f"anoisesrc=color={color}:duration=2:amplitude={amp:.4f}",
             "-ac", "1", "-ar", str(SR), out],
            capture_output=True, check=True)

    for k, d in dirs.items():
        print(f"  {k}: {len(os.listdir(d))} clips")
    print("DONE")


if __name__ == "__main__":
    main()
