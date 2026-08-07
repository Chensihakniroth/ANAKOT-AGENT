---
title: Wake Word
description: Hands-free "hey casca" hotword detection with a free, local, on-device openWakeWord model — no cloud, no keys.
sidebar_label: Wake Word
sidebar_position: 10
---

# Wake Word

Say **"hey casca"** to wake the assistant. Wake-word detection runs **100% on-device**
with an openWakeWord model — no cloud round-trip, no API keys, no audio leaves your
machine.

## How it works

- **Engine:** [openWakeWord](https://github.com/dscripka/openWakeWord) (Apache-2.0)
  streams 80 ms frames of mic audio through a local ONNX model and scores each
  frame 0..1.
- **Bundled model:** `tools/wakewords/hey_casca.onnx` — a model custom-trained for
  the phrase "hey casca" (see [Training your own model](#training-your-own-model)
  below). It is the default; no setup is required to say "hey casca".
- **Confirmation frames:** a single over-threshold frame is not enough — the score
  must stay above the threshold for **3 consecutive frames** (~240 ms) before the
  detector fires. This is the primary guard against stray phonemes in ambient talk.
- **Shared feature models:** openWakeWord's melspectrogram + embedding models are
  fetched once on first use and cached locally.

## Configuration

The feature is configured by the `wake_word` section in your config
(`~/.anakot/config.yaml` or per-profile config):

```yaml
wake_word:
  provider: openwakeword      # engine (only openwakeword today)
  phrase: "hey casca"         # display/UI label for the phrase
  sensitivity: 0.6            # score threshold 0..1 — higher = fewer false fires
  confirmation_frames: 3      # consecutive over-threshold frames required
  capture: auto               # "auto" = local mic when available, else client capture
  start_new_session: true     # begin a fresh session when woken
  openwakeword:
    model: hey_casca          # bundled alias, built-in openWakeWord name, or a path
```

### Tuning `sensitivity`

- Raise it (e.g. `0.7`) if the detector fires on background TV/other voices.
- Lower it (e.g. `0.5`) if your own "hey casca" is being missed (soft voices,
  far-from-mic setups).

### Choosing a model (`wake_word.openwakeword.model`)

- `hey_casca` (alias: `hey casca`, `casca`) — the bundled default.
- `hey_hermes` (alias: `hermes`) — the optional bundled alternative, listens for
  "hey hermes".
- Any built-in openWakeWord name (`hey_jarvis`, `alexa`, `hey_mycroft`, …) —
  downloaded automatically on first use.
- A path to your own `.onnx`/`.tflite` — see the training guide below.

## Known limitations

- **Near-identical phrases.** A model trained on TTS "hey casca" can score highly on
  phonetically close phrases ("hey pasta", "hey carol", "hey gas can"). The 3-frame
  confirmation filter rejects most of these; raise `sensitivity` if you hear
  persistent near-miss triggers.
- **Voice variance.** Models are trained on synthetic TTS voices; very different
  real speakers, accents, or heavily backgrounded audio may need a lower
  `sensitivity`. Users with an unusual voice can train a custom model (below).
- **First 1–2 seconds after start.** openWakeWord's streaming buffer starts with a
  warm-up prefill, so utterances in the very first moment after the detector starts
  can behave differently. In practice ambient silence precedes any utterance.

## Training your own model

The training pipeline is checked in at **`tools/wakeword_training/`** (see its
README) and is fully reproducible — stage-resumable scripts that run with the
project venv (Python 3.11 with `edge-tts`, `ffmpeg`, `torch`, `openwakeword`,
plus an [openWakeWord](https://github.com/dscripka/openWakeWord) clone for its
vendored `train.py`, pointed at via `OPENWAKEWORD_REPO`).

### 1. Generate the dataset

`generate_clips.py` synthesizes speech with edge-tts and augments with ffmpeg
(pitch/rate shifts, noise mixes):

```bash
python generate_clips.py pos      # "hey casca" positives (many voices, variants)
python generate_clips.py neg      # unrelated sentences (negatives)
python generate_clips.py hard     # near-miss confusables ("hey pasta", ...)
python generate_clips.py assemble # 2.0s padded clips, train/test split
```

`hard` is the important part: it mines phrases the previous model falsely fired on
and re-synthesizes them across all voices — hard-negative mining in one command.

### 2. Train

`train_hey_casca.py` is stage-based so each stage fits a single run:

```bash
python train_hey_casca.py features  # extract training windows -> .npy cache
python train_hey_casca.py train     # train + export ONNX
python train_hey_casca.py validate  # runtime sweep: positives / negatives / hard
```

**Why "features" matters:** openWakeWord's runtime does NOT extract features in one
batch — it streams audio through a stateful preprocessor (pre-filled with a noise
warm-up, one immutable embedding row appended per 80 ms chunk) and scores the last
16 rows after every chunk. Training features must be extracted through that exact
path, or the model learns a feature distribution it never sees at runtime. The
`features` stage reproduces the runtime path chunk-for-chunk; labels come from the
window's audio coverage (a window spans the last 1.28 s) intersecting the detected
phrase region.

The default architecture is a 256-wide, 2-block MLP over the 96-dim embeddings
(~2 MB ONNX), trained 6000 steps with a warm-up + hold LR schedule and a negative
weight ramp that peaks at 60× so confusables get driven down hard.

### 3. Validate & ship

`validate` scores every held-out clip through the real runtime `Model` (fresh
streaming state per clip) and reports: all positives must fire, negatives and hard
confusables must stay under threshold. The exported `hey_casca.onnx` is a
single self-contained file (external weights are merged back in) — copy it into
`tools/wakewords/` and it is picked up automatically as the default.
