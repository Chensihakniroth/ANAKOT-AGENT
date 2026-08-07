# Bundled wake-word models

`hey_casca.onnx` / `hey_casca.tflite` — the on-device "Hey Casca" hotword
model. This is the default detector for the wake word feature (see
`website/docs/user-guide/features/wake-word.md`); no training or setup is
required to say "hey casca".

- **Engine:** [openWakeWord](https://github.com/dscripka/openWakeWord) (Apache-2.0).
- **Provenance:** custom-trained for the "hey casca" phrase with the project's
  synthetic-TTS training pipeline (edge-tts voices + ffmpeg augmentation; see
  the wake-word docs, "Training your own model"). Training features were
  extracted through openWakeWord's streaming preprocessor so the model sees
  exactly what the runtime sees. ~16K phrase windows vs ~26K negatives
  (sentences + near-miss confusables + noise), 6000 steps, 256×2 MLP.
- **Label:** the model registers as `hey_casca` (matches the filename).
- **Runtime:** openWakeWord's shared feature-extraction models (melspectrogram +
  embedding) are NOT bundled here — they are fetched once on first use by
  `tools/wake_word.py` via `openwakeword.utils.download_models()`.

`hey_hermes.onnx` / `hey_hermes.tflite` — the previous default, kept as an
optional alternative: point `wake_word.openwakeword.model` at `hey_hermes`
(alias `hermes`) to listen for "hey hermes" instead.

To use a different phrase, train your own model and point
`wake_word.openwakeword.model` at its path, or set a built-in openWakeWord name
(`hey_jarvis`, `alexa`, `hey_mycroft`, …). See the wake-word docs for the
training guide.
