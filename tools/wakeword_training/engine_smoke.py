"""Integration smoke test v2: real engine, realistic streaming (1s ambient pre-roll)."""
import os
import soundfile as sf
import numpy as np
import sys

sys.path.insert(0, r"D:\School\PROJECT\anakot-agent")
from tools.wake_word import _OpenWakeWordEngine  # noqa: E402

DATA = r"C:\Users\Niroth\AppData\Local\Temp\wakeword-training\hey_casca_data"
POS = os.path.join(DATA, "positive_test")
NEG = os.path.join(DATA, "negative_test")

eng = _OpenWakeWordEngine({})
print("labels:", eng._labels, "| threshold:", eng._threshold, "| confirm:", eng._confirm_needed)


def scan(path, pad=16000):
    """1s of ambient silence pre-roll, then the clip — mirrors continuous mic streaming."""
    x, _ = sf.read(path, dtype="int16")
    data = np.concatenate([np.zeros(pad, np.int16), x])
    eng._confirm_streak = 0
    eng._model.preprocessor.reset()
    fired = False
    for i in range(0, len(data) - 1280, 1280):
        if eng.process(data[i:i + 1280]):
            fired = True
    return fired


pos_results = []
for f in sorted(os.listdir(POS))[:9]:
    pos_results.append((f, scan(os.path.join(POS, f))))
print(f"POS: {sum(1 for _, b in pos_results if b)}/9 fired")
print("  failing:", [f for f, b in pos_results if not b])

neg_fires = []
for f in sorted(os.listdir(NEG)):
    if scan(os.path.join(NEG, f)):
        neg_fires.append(f)
print(f"NEG: {len(neg_fires)}/38 false-fired")
print("  firers:", neg_fires)
