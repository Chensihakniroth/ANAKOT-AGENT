"""Simulate the REAL app wake-word logic (3 consecutive frames >= 0.6)."""
import numpy as np, soundfile as sf, random, sys, os
from openwakeword import Model

onnx = r"C:\Users\Niroth\AppData\Local\Temp\wakeword-training\hey_casca_model\hey_casca.onnx"
rm = Model(wakeword_models=[onnx], inference_framework="onnx")
name = list(rm.models.keys())[0]
DATA = r"C:\Users\Niroth\AppData\Local\Temp\wakeword-training\hey_casca_data"
THR = 0.6
CONF = 3
DIRS = {"pos": "positive_test", "neg": "negative_test", "hard": "hard_negatives"}


def app_scan(path):
    x, sr = sf.read(path, dtype="int16")
    data = np.concatenate([np.zeros(16000, np.int16), x, np.zeros(16000, np.int16)])
    rm.preprocessor.reset()
    streak = 0
    max_s = 0.0
    fired = False
    n_frames_over = 0
    for c in range((len(data) - 1280) // 1280):
        s = float(rm.predict(data[c * 1280:(c + 1) * 1280])[name])
        max_s = max(max_s, s)
        if s >= THR:
            n_frames_over += 1
            streak += 1
            if streak >= CONF:
                fired = True
        else:
            streak = 0
    return fired, round(max_s, 3), n_frames_over


def sweep(directory, n=None):
    files = sorted(f for f in os.listdir(directory) if f.endswith(".wav"))
    rng = random.Random(3)
    rng.shuffle(files)
    if n:
        files = files[:n]
    return [(f,) + app_scan(os.path.join(directory, f)) for f in files]


which = sys.argv[1] if len(sys.argv) > 1 else "pos"
n = int(sys.argv[2]) if len(sys.argv) > 2 else None
res = sweep(os.path.join(DATA, DIRS[which]), n)
fires = [r for r in res if r[1]]
print(f"{which}: {len(fires)}/{len(res)} fired (3-consec >= {THR})")
if which == "pos":
    print("  maxs:", [r[2] for r in res])
else:
    print("  firers (file, max, frames>0.6):", [(r[0], r[2], r[3]) for r in fires][:25])

