"""Train the "hey casca" wake-word model (openwakeword pipeline, PyTorch).

Stage-based (run with the project venv):
    python train_hey_casca.py features   # extract streaming windows -> .npy cache
    python train_hey_casca.py train      # train + export ONNX
    python train_hey_casca.py validate   # runtime sweep: pos / neg / hard

CRITICAL: training windows must match the RUNTIME feature pipeline exactly.
The runtime (openwakeword Model.predict on 1280-sample chunks) feeds audio to a
STREAMING preprocessor whose feature_buffer is pre-filled with embeddings of 4s
of random noise (reset()), then appends ONE immutable embedding row per chunk.
predict() scores the LAST 16 rows after each chunk. We reproduce that here:
per clip -> reset() -> feed the same 49 chunks -> window after chunk c is the
buffer's last 16 rows (covers padded-audio chunks [c-15, c]).

Labels: negatives/hard -> all 0. Positives -> 1 iff the window's chunk range
overlaps the detected phrase region (speech energy on the unpadded clip,
shifted by the 1s padding). Silence-only windows -> 0.
"""
import importlib.util
import os
import random
import sys
import types

import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F

SCRATCH = os.environ.get("WAKEWORD_TRAIN_ROOT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_data"))
REPO = os.environ.get("OPENWAKEWORD_REPO", os.path.join(SCRATCH, "openWakeWord"))
DATA = os.path.join(SCRATCH, "hey_casca_data")
OUT_DIR = os.path.join(SCRATCH, "hey_casca_model")
CACHE = os.path.join(SCRATCH, "win_cache")

SR = 16000
N_FRAMES = 16
EMB_DIM = 96
SEED = 7
PAD_S = 1.0      # silence padding (matches runtime predict_clip)
CHUNK = 1280     # runtime chunk size
N_CHUNKS = 49    # predict_clip feeds range(0, len-1280, 1280) -> 49 for 4s

torch.manual_seed(SEED)
np.random.seed(SEED)
random.seed(SEED)


def _stub_module(name):
    m = types.ModuleType(name)
    m.__path__ = []
    return m


# Stub packages: acoustics is broken on scipy>=1.16; the real speechbrain drags
# fragile k2_fsa LazyModule machinery that crashes torch custom-op introspection.
if "speechbrain" not in sys.modules:
    sb = _stub_module("speechbrain")
    d1 = _stub_module("speechbrain.dataio")
    d2 = _stub_module("speechbrain.dataio.dataio")
    d2.read_audio = lambda *a, **k: None
    p1 = _stub_module("speechbrain.processing")
    p2 = _stub_module("speechbrain.processing.signal_processing")
    p2.reverberate = lambda *a, **k: None
    d1.dataio = d2
    p1.signal_processing = p2
    sb.dataio = d1
    sb.processing = p1
    sys.modules.update({
        "speechbrain": sb, "speechbrain.dataio": d1,
        "speechbrain.dataio.dataio": d2,
        "speechbrain.processing": p1,
        "speechbrain.processing.signal_processing": p2,
    })
try:
    import acoustics  # noqa: F401
except Exception:
    ac = _stub_module("acoustics")
    ac.generator = types.ModuleType("acoustics.generator")
    sys.modules["acoustics"] = ac
    sys.modules["acoustics.generator"] = ac.generator

spec = importlib.util.spec_from_file_location("oww_train", os.path.join(REPO, "openwakeword", "train.py"))
oww_train = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oww_train)
Model = oww_train.Model

from openwakeword.utils import AudioFeatures  # noqa: E402
from openwakeword import Model as RuntimeModel  # noqa: E402


def phrase_chunks(path):
    """Detect the speech region of a clip at chunk granularity (unpadded).

    Returns (start_chunk, end_chunk) exclusive-end in UNPADDED clip chunks.
    """
    x, sr = sf.read(path, dtype="int16")
    n = len(x) // CHUNK
    energy = []
    for c in range(n):
        seg = x[c * CHUNK:(c + 1) * CHUNK].astype(np.float32)
        energy.append(float(np.sqrt(np.mean(seg ** 2) + 1e-12)))
    thr = 0.02
    speech = [c for c, e in enumerate(energy) if e >= thr]
    if not speech:
        return (0, 0)
    return (min(speech), max(speech) + 1)


def clip_windows(AF, path):
    """Feed a clip through the runtime streaming preprocessor (fresh state).

    Returns (windows, n) where windows is (N_CHUNKS, 16, 96) — the exact
    windows predict() scores after each chunk — and n is the chunk count.
    """
    x, sr = sf.read(path, dtype="int16")
    pad = int(sr * PAD_S)
    data = np.concatenate([np.zeros(pad, np.int16), x, np.zeros(pad, np.int16)])
    AF.reset()
    windows = []
    n_chunks = (len(data) - CHUNK) // CHUNK  # same as predict_clip's range
    for c in range(n_chunks):
        chunk = data[c * CHUNK:(c + 1) * CHUNK]
        AF(chunk)
        windows.append(AF.get_features(N_FRAMES)[0])  # (16, 96)
    return np.stack(windows), n_chunks


def extract_key(AF, key, d, is_pos, files, npz):
    """Resumable extraction. The partial npz is the ONLY source of truth:
    it stores (W, L, names) so the covered files are self-describing —
    no separate manifest that can drift from the checkpointed windows."""
    partial_npz = npz + ".partial"
    Ws, Ls, names = [], [], []
    if os.path.exists(partial_npz):
        try:
            p = np.load(partial_npz)
            Ws.append(p["W"])
            Ls.append(p["L"])
            names = list(p["names"])
            print(f"  {key}: resumed from partial ({len(names)} files, "
                  f"{int(p['W'].shape[0])} windows)")
        except Exception as e:
            print(f"  {key}: partial unreadable ({e!r}) — restarting from scratch")
            Ws, Ls, names = [], [], []
    done = set(names)
    todo = [f for f in files if f not in done]
    if not todo:
        W = np.concatenate(Ws).astype(np.float32)
        L = np.concatenate(Ls).astype(np.float32)
        np.savez_compressed(npz, W=W, L=L)
        if os.path.exists(partial_npz):
            os.remove(partial_npz)
        print(f"  {key}: {W.shape} windows ({L.sum():.0f} positives)")
        return
    print(f"  {key}: {len(files)} files, {len(todo)} todo")
    for i, f in enumerate(todo):
        p = os.path.join(d, f)
        w, _ = clip_windows(AF, p)
        if is_pos:
            s, e = phrase_chunks(p)
            # window c covers padded chunks [c-15, c]; phrase region is
            # shifted by PAD_S*SR//CHUNK (=12.5 chunks) in the padded stream
            off = int(round(PAD_S * SR / CHUNK))
            labels = np.zeros(len(w), np.float32)
            for c in range(len(w)):
                lo, hi = c - (N_FRAMES - 1), c + 1
                if hi > off + s and lo < off + e:
                    labels[c] = 1.0
        else:
            labels = np.zeros(len(w), np.float32)
        Ws.append(w)
        Ls.append(labels)
        names.append(f)
        if (i + 1) % 100 == 0:
            W = np.concatenate(Ws).astype(np.float32)
            L = np.concatenate(Ls).astype(np.float32)
            np.savez_compressed(partial_npz, W=W, L=L, names=names)
            print(f"    {key} {i + 1}/{len(todo)} (checkpointed {W.shape[0]} windows)")
    W = np.concatenate(Ws).astype(np.float32)
    L = np.concatenate(Ls).astype(np.float32)
    np.savez_compressed(npz, W=W, L=L)
    if os.path.exists(partial_npz):
        os.remove(partial_npz)
    print(f"  {key}: {W.shape} windows ({L.sum():.0f} positives)")


def extract_stage(AF):
    os.makedirs(CACHE, exist_ok=True)
    for key, dirname, is_pos in [("pos", "positive_train", True),
                                 ("neg", "negative_train", False),
                                 ("hard", "hard_negatives", False),
                                 ("pos_t", "positive_test", True),
                                 ("neg_t", "negative_test", False)]:
        d = os.path.join(DATA, dirname)
        if not os.path.isdir(d):
            continue
        npz = os.path.join(CACHE, f"{key}.npz")
        if os.path.exists(npz):
            print(f"  {key}: cached")
            continue
        files = sorted(f for f in os.listdir(d) if f.endswith(".wav"))
        # hard: hold out 10% (seeded shuffle) so validation sees hard clips
        if key == "hard":
            rng = random.Random(5)
            rng.shuffle(files)
            n_t = max(1, len(files) // 10)
            train_files, test_files = files[n_t:], files[:n_t]
            npz_t = os.path.join(CACHE, "hard_t.npz")
            if not os.path.exists(npz_t):
                extract_key(AF, "hard_t", d, False, test_files, npz_t)
            files = train_files
        extract_key(AF, key, d, is_pos, files, npz)
    print("EXTRACT DONE")


def load_pool(key):
    npz = np.load(os.path.join(CACHE, f"{key}.npz"))
    return torch.from_numpy(npz["W"]), torch.from_numpy(npz["L"])


def train_stage():
    pos, pos_l = load_pool("pos")
    neg, neg_l = load_pool("neg")
    hard, hard_l = load_pool("hard")
    pos_test, pos_test_l = load_pool("pos_t")
    neg_test, _ = load_pool("neg_t")
    hard_test, _ = load_pool("hard_t")
    print(f"  pos={pos.shape} ({pos_l.sum():.0f} phrase) neg={neg.shape} hard={hard.shape} "
          f"pos_test={pos_test.shape} neg_test={neg_test.shape} hard_test={hard_test.shape}")

    n_pos = len(pos)
    n_neg = len(neg)
    n_hard = len(hard)
    # only phrase-labeled windows are real positives; silence windows of
    # positive clips add nothing (plain negatives already cover silence)
    pos_phrase = pos[pos_l == 1]
    n_pp = len(pos_phrase)

    # validation: all windows of held-out clips + hard holdout
    n_pos_v = int(pos_test_l.sum())
    X_val = torch.cat([pos_test, neg_test, hard_test])
    y_val = torch.cat([pos_test_l, torch.zeros(len(neg_test)), torch.zeros(len(hard_test))])

    model = Model(input_shape=(N_FRAMES, EMB_DIM), n_classes=1, layer_dim=256, n_blocks=2,
                  seconds_per_example=1280 * N_FRAMES / SR)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

    STEPS = 8000
    WARMUP = 500
    HOLD = 1000
    BATCH_POS = 32
    BATCH_NEG = 16
    BATCH_HARD = 32        # mined: top-k most confusing of a candidate pool
    MINE_POOL = 256        # hard candidate pool per step
    MAX_NEG_W = 5.0        # plain negatives: gentle ramp
    MAX_HARD_W = 10.0      # hard negatives: moderate (mining does the heavy lifting)

    def lr_at(step):
        if step < WARMUP:
            return 1e-3 * (step + 1) / WARMUP
        if step < WARMUP + HOLD:
            return 1e-3
        prog = (step - WARMUP - HOLD) / max(1, STEPS - WARMUP - HOLD)
        return 1e-5 + 0.5 * (1e-3 - 1e-5) * (1 + np.cos(np.pi * prog))

    def neg_w_at(step):
        prog = step / max(1, STEPS)
        return 1.0 + (MAX_NEG_W - 1.0) * prog

    def hard_w_at(step):
        prog = step / max(1, STEPS)
        return 1.0 + (MAX_HARD_W - 1.0) * prog

    def evaluate(step, tag="train"):
        with torch.no_grad():
            probs = model(X_val).squeeze(1)
            preds = (probs >= 0.5).float()
            # X_val = [pos_test | neg_test | hard_test]; slice by block length
            b0, b1 = 0, len(pos_test)
            b2 = b1 + len(neg_test)
            p_pos = preds[b0:b1]
            y_pos = pos_test_l
            p_neg = preds[b1:b2]
            p_hard = preds[b2:]
            n_pos_v = int(y_pos.sum())
            tp = (p_pos * y_pos).sum().item()
            fp = p_neg.sum().item() + p_hard.sum().item()
            fp_hard = p_hard.sum().item()
            recall = tp / max(1, n_pos_v)
            fp_rate = fp / max(1, len(p_neg) + len(p_hard))
            hard_fp = fp_hard / max(1, len(p_hard))
            # acc over all windows (pos labeled, rest 0)
            y_all = torch.cat([y_pos, torch.zeros(len(p_neg)), torch.zeros(len(p_hard))])
            acc = ((preds == y_all).sum().item()) / len(y_all)
        print(f"  [{tag}] step={step} acc={acc:.3f} recall={recall:.3f} "
              f"fp_rate={fp_rate:.3f} hard_fp={hard_fp:.3f}")
        return recall * 0.9 if recall < 0.8 else acc, acc, recall, fp_rate

    best = {"score": -1.0, "state": None}
    print("== training ==")
    for step in range(STEPS):
        pi = np.random.randint(0, n_pp, BATCH_POS)
        ni = np.random.randint(0, n_neg, BATCH_NEG)
        # online hard-negative mining: score a candidate pool, keep the most
        # confusing (highest-scoring) hard windows for this step
        model.eval()
        with torch.no_grad():
            m = np.random.randint(0, n_hard, MINE_POOL)
            cand = hard[m]
            scores = model(cand).squeeze(1)
            _, keep = torch.topk(scores, BATCH_HARD)
            hi = m[keep.cpu().numpy()]
        model.train()
        xb = torch.cat([pos_phrase[pi], neg[ni], hard[hi]])
        yb = torch.cat([torch.ones(BATCH_POS), neg_l[ni], hard_l[hi]]).unsqueeze(1)

        probs = model(xb).clamp(1e-7, 1 - 1e-7)  # Model.forward ends with Sigmoid
        loss = F.binary_cross_entropy(probs, yb, reduction="none")
        # per-class weights: positives 1.0, plain negatives ramp 1->5,
        # hard negatives ramp 1->10 (mining already focuses them)
        nw = neg_w_at(step)
        hw = hard_w_at(step)
        w_all = torch.cat([torch.ones(BATCH_POS),
                           torch.full((BATCH_NEG,), nw),
                           torch.full((BATCH_HARD,), hw)]).unsqueeze(1)
        weights = torch.where(yb == 1, torch.tensor(1.0), w_all)
        loss = (loss * weights).mean()

        opt.zero_grad()
        loss.backward()
        opt.step()
        for g in opt.param_groups:
            g["lr"] = lr_at(step)

        if (step + 1) % 500 == 0 or step == STEPS - 1:
            score, acc, recall, fp = evaluate(step + 1, tag="train")
            model.train()
            if score > best["score"]:
                best["score"] = score
                best["state"] = {k: v.clone() for k, v in model.state_dict().items()}
                print(f"    best score={score:.3f}")

    print("== exporting ONNX ==")
    model.load_state_dict(best["state"])
    model.eval()
    os.makedirs(OUT_DIR, exist_ok=True)
    onnx_path = os.path.join(OUT_DIR, "hey_casca.onnx")
    torch.onnx.export(model.to("cpu"), torch.rand(1, N_FRAMES, EMB_DIM), onnx_path,
                      input_names=["input"], output_names=["output"], opset_version=13)
    # merge external weight data back into a single self-contained ONNX
    import onnx
    m = onnx.load(onnx_path)
    onnx.save(m, onnx_path)
    print("  saved", onnx_path, os.path.getsize(onnx_path), "bytes (single file)")


def validate_stage():
    onnx_path = os.path.join(OUT_DIR, "hey_casca.onnx")
    rm = RuntimeModel(wakeword_models=[onnx_path], inference_framework="onnx")
    name = list(rm.models.keys())[0]

    def peak(path):
        # clean streaming per clip: reset preprocessor, feed chunks, max score
        x, sr = sf.read(path, dtype="int16")
        data = np.concatenate([np.zeros(16000, np.int16), x, np.zeros(16000, np.int16)])
        rm.preprocessor.reset()
        best = 0.0
        for c in range((len(data) - CHUNK) // CHUNK):
            p = rm.predict(data[c * CHUNK:(c + 1) * CHUNK])
            best = max(best, float(p[name]))
        return best

    def score_dir(directory, n=None):
        files = sorted(f for f in os.listdir(directory) if f.endswith(".wav"))
        rng = random.Random(3)
        rng.shuffle(files)
        if n:
            files = files[:n]
        return [(f, peak(os.path.join(directory, f))) for f in files]

    pos = score_dir(os.path.join(DATA, "positive_test"))
    neg = score_dir(os.path.join(DATA, "negative_test"))
    hard = score_dir(os.path.join(DATA, "hard_negatives"))
    pos_s = [s for _, s in pos]
    neg_s = [s for _, s in neg]
    hard_s = [s for _, s in hard]
    print("  pos:", [round(s, 3) for s in pos_s])
    print("  neg:", [round(s, 3) for s in neg_s])
    print(f"  pos min={min(pos_s):.3f} mean={np.mean(pos_s):.3f} | "
          f"neg max={max(neg_s):.3f} mean={np.mean(neg_s):.3f} | "
          f"hard max={max(hard_s):.3f} mean={np.mean(hard_s):.3f}")
    firing_hard = [f for f, s in hard if s >= 0.5]
    print("  hard firers:", firing_hard[:14], f"({len(firing_hard)}/{len(hard)})")
    ok_pos = all(s >= 0.5 for s in pos_s)
    ok_neg = all(s < 0.5 for s in neg_s)
    ok_hard = all(s < 0.5 for s in hard_s)
    print("VALIDATION", "PASS ✅" if ok_pos and ok_neg and ok_hard else "FAIL ❌")
    if ok_pos and ok_neg and ok_hard:
        import shutil
        dst = os.path.join(r"D:\School\PROJECT\anakot-agent", "tools", "wakewords", "hey_casca.onnx")
        shutil.copy2(onnx_path, dst)
        print("  bundled ->", dst)


def main():
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    if stage not in ("features", "train", "validate", "all"):
        print(f"unknown stage {stage!r} (use features|train|validate|all)")
        return
    AF = AudioFeatures(device="cpu")
    if stage in ("features", "all"):
        extract_stage(AF)
    if stage in ("train", "all"):
        train_stage()
    if stage in ("validate", "all"):
        validate_stage()


if __name__ == "__main__":
    main()
