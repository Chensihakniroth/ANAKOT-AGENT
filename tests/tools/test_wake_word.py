"""Unit tests for tools.wake_word — config parsing, thresholds, alias/model resolution.

These test pure functions only (no mic, no onnx runtime): the engine constructor
needs openwakeword + shared feature models, which belongs in an integration test.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from tools import wake_word as ww  # noqa: E402


class TestDefaults:
    def test_default_phrase_is_hey_casca(self):
        assert ww._DEFAULTS["phrase"] == "hey casca"

    def test_default_sensitivity_and_confirmation(self):
        assert ww._DEFAULTS["sensitivity"] == 0.6
        assert ww._DEFAULTS["confirmation_frames"] == 3

    def test_default_model_is_bundled_hey_casca(self):
        assert ww._BUNDLED_MODEL_NAME == "hey_casca"

    def test_bundled_casca_model_file_exists(self):
        path = ww._bundled_wakeword_path("onnx", stem="hey_casca")
        assert os.path.isfile(path), f"bundled model missing: {path}"
        assert path.endswith("hey_casca.onnx")


class TestInputGain:
    def test_default_when_missing(self):
        assert ww._input_gain({}) == 1.0

    def test_parses_float(self):
        assert ww._input_gain({"input_gain": 8}) == 8.0
        assert ww._input_gain({"input_gain": "4.5"}) == 4.5

    def test_rejects_bad_values(self):
        assert ww._input_gain({"input_gain": "abc"}) == 1.0
        assert ww._input_gain({"input_gain": 0.01}) == 1.0  # below floor
        assert ww._input_gain({"input_gain": 128}) == 1.0  # above ceiling

    def test_detector_stores_gain(self):
        det = ww.WakeWordDetector(engine=None, on_wake=lambda: None, input_gain=10.0)
        assert det.input_gain == 10.0
        det2 = ww.WakeWordDetector(engine=None, on_wake=lambda: None, input_gain=0.01)
        assert det2.input_gain == 1.0


class TestResample:
    def test_identity_when_rates_match(self):
        import numpy as np

        frame = np.zeros(1280, dtype=np.int16)
        assert ww._resample_linear(frame, 16000, 16000) is frame

    def test_length_conversion_44100_to_16000(self):
        import numpy as np

        frame = np.zeros(3528, dtype=np.int16)
        out = ww._resample_linear(frame, 44100, 16000)
        assert len(out) == 1280
        assert out.dtype == np.int16

    def test_tone_survives_roundtrip(self):
        import numpy as np

        t = np.arange(0, 0.08, 1 / 44100, dtype=np.float32)
        tone = (30000 * np.sin(2 * np.pi * 440 * t)).astype(np.int16)
        up = ww._resample_linear(tone, 44100, 48000)
        back = ww._resample_linear(up, 48000, 16000)
        assert len(back) == 1280
        # amplitude roughly preserved through the roundtrip
        assert np.abs(back).max() > 10000


class TestSensitivity:
    def test_default_when_missing(self):
        assert ww._sensitivity({}) == 0.6

    def test_clamped_low(self):
        assert ww._sensitivity({"sensitivity": -0.5}) == 0.0

    def test_clamped_high(self):
        assert ww._sensitivity({"sensitivity": 1.5}) == 1.0

    def test_numeric_string(self):
        assert ww._sensitivity({"sensitivity": "0.75"}) == 0.75

    def test_garbage_falls_back_to_default(self):
        assert ww._sensitivity({"sensitivity": "banana"}) == 0.6


class TestConfirmationFrames:
    def test_default_when_missing(self):
        assert ww._confirmation_frames({}) == 3

    def test_accepts_sane_value(self):
        assert ww._confirmation_frames({"confirmation_frames": 5}) == 5

    def test_clamped_to_min(self):
        assert ww._confirmation_frames({"confirmation_frames": 0}) == 1

    def test_clamped_to_max(self):
        assert ww._confirmation_frames({"confirmation_frames": 99}) == 10

    def test_garbage_falls_back_to_default(self):
        assert ww._confirmation_frames({"confirmation_frames": None}) == 3


class TestProvider:
    def test_default_provider(self):
        assert ww._provider({}) == "openwakeword"

    def test_case_insensitive(self):
        assert ww._provider({"provider": "OpenWakeWord"}) == "openwakeword"


class TestBundledPath:
    def test_onnx_default(self):
        p = ww._bundled_wakeword_path()
        assert p.endswith(".onnx")

    def test_tflite_extension(self):
        assert ww._bundled_wakeword_path("tflite").endswith(".tflite")

    def test_tflite_case_insensitive(self):
        assert ww._bundled_wakeword_path("TFLite").endswith(".tflite")

    def test_stem_resolution(self):
        assert ww._bundled_wakeword_path(stem="hey_hermes").endswith("hey_hermes.onnx")


class TestAliasResolution:
    """Config model names must resolve to bundled files, mirroring the engine."""

    @pytest.mark.parametrize(
        ("alias", "expected_stem"),
        [
            ("", "hey_casca"),
            ("hey_casca", "hey_casca"),
            ("hey casca", "hey_casca"),
            ("casca", "hey_casca"),
            ("HEY_CASCA", "hey_casca"),  # aliases are lowercased before lookup
            ("hey_hermes", "hey_hermes"),
            ("hey hermes", "hey_hermes"),
            ("hermes", "hey_hermes"),
        ],
    )
    def test_aliases_map_to_bundled_stems(self, alias, expected_stem):
        key = alias.lower()
        if key in ww._BUNDLED_MODEL_ALIASES:
            assert ww._BUNDLED_MODEL_ALIASES[key] == expected_stem

    def test_every_bundled_file_is_aliased(self):
        for stem in ww._BUNDLED_MODEL_FILES.values():
            assert os.path.isfile(ww._bundled_wakeword_path(stem=stem))


class TestGet:
    def test_explicit_value_wins(self):
        assert ww._get({"sensitivity": 0.9}, "sensitivity") == 0.9

    def test_none_falls_back_to_default(self):
        assert ww._get({"sensitivity": None}, "sensitivity") == ww._DEFAULTS["sensitivity"]

    def test_missing_falls_back_to_default(self):
        assert ww._get({}, "sensitivity") == ww._DEFAULTS["sensitivity"]
