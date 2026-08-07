# Wake-word training pipeline

Reproduces the bundled `tools/wakewords/hey_casca.onnx` model. All data and
artifacts are written under `training_data/` (gitignored) so a checkout stays
clean — point `WAKEWORD_TRAIN_ROOT` elsewhere to relocate it.

## Requirements

- Project venv (Python 3.11) with: `edge-tts`, `ffmpeg`, `soundfile`, `torch`,
  `onnxruntime`, `openwakeword`, `openwakeword`'s training deps
  (`onnxscript`, `torchinfo`, `torchmetrics`, `pronouncing`, `mutagen`, …).
- A clone of [openWakeWord](https://github.com/dscripka/openWakeWord) for the
  vendored `train.py` it needs: set `OPENWAKEWORD_REPO` to that clone (default:
  `training_data/openWakeWord`).

## Stages

```bash
python generate_clips.py pos      # "hey casca" positives (12 voices, pitch/rate variants)
python generate_clips.py neg      # unrelated sentences (negatives)
python generate_clips.py hard     # near-miss confusables ("hey pasta", ...) — hard-negative mining
python generate_clips.py assemble # 2.0s padded clips + train/test split

python train_hey_casca.py features  # extract STREAMING-aligned windows -> .npz cache
python train_hey_casca.py train     # train + export single-file ONNX
python train_hey_casca.py validate  # runtime sweep: positives / negatives / hard
```

## Why "streaming-aligned" matters

openWakeWord's runtime does not extract features in one batch: it streams audio
through a stateful preprocessor (pre-filled with a noise warm-up, one immutable
embedding row appended per 80 ms chunk) and scores the last 16 rows after every
chunk. Batch-extracted features are numerically different (the docs admit this).
Training on the batch path produces models that look great in training but fire
on everything at runtime. The `features` stage feeds each clip chunk-by-chunk
through the exact runtime path, so the model learns the distribution it will
actually see.

## Validation helpers

- `app_scan.py` — scores clips through the real runtime with the app's exact
  firing rule (3 consecutive frames >= sensitivity, default 0.6).
- `engine_smoke.py` — drives `tools.wake_word._OpenWakeWordEngine` end-to-end
  (alias resolution -> bundled model -> threshold + confirmation frames).

Known-good numbers for the bundled `hey_casca.onnx`: 8/9 held-out TTS positives
fire, 0/38 sentence negatives fire, phonetically near-identical confusables
("hey pasta", "hey carol") remain a documented limitation.
