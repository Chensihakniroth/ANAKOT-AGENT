"""Regression tests for _apply_profile_override ANAKOT_HOME guard (issue #22502).

When ANAKOT_HOME is set to the anakot root (e.g. systemd hardcodes
ANAKOT_HOME=/root/.anakot), _apply_profile_override must still read
active_profile and update ANAKOT_HOME to the profile directory.

When ANAKOT_HOME is already a profile directory (.../profiles/<name>),
_apply_profile_override must trust it and return without re-reading
active_profile (child-process inheritance contract).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path



def _run_apply_profile_override(
    tmp_path, monkeypatch, *, anakot_home: str | None, active_profile: str | None,
    argv: list[str] | None = None,
):
    """Run _apply_profile_override in isolation.

    Returns the value of os.environ["ANAKOT_HOME"] after the call,
    or None if unset.
    """
    anakot_root = tmp_path / ".anakot"
    anakot_root.mkdir(parents=True, exist_ok=True)

    if active_profile is not None:
        (anakot_root / "active_profile").write_text(active_profile)

    if active_profile and active_profile != "default":
        (anakot_root / "profiles" / active_profile).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    if anakot_home is not None:
        monkeypatch.setenv("ANAKOT_HOME", anakot_home)
    else:
        monkeypatch.delenv("ANAKOT_HOME", raising=False)

    monkeypatch.setattr(sys, "argv", argv or ["anakot", "gateway", "start"])

    from anakot_cli.main import _apply_profile_override
    _apply_profile_override()

    return os.environ.get("ANAKOT_HOME")


class TestApplyProfileOverrideAnakotHomeGuard:
    """Regression guard for issue #22502.

    Verifies that ANAKOT_HOME pointing to the anakot root does NOT suppress
    the active_profile check, while ANAKOT_HOME already pointing to a
    profile directory IS trusted as-is.
    """

    def test_anakot_home_at_root_with_active_profile_is_redirected(
        self, tmp_path, monkeypatch
    ):
        """ANAKOT_HOME=/root/.anakot + active_profile=coder must redirect
        ANAKOT_HOME to .../profiles/coder.

        Bug scenario from #22502: systemd sets ANAKOT_HOME to the anakot root
        and the user switches to a profile via `anakot profile use`.
        Before the fix, the guard returned early and active_profile was ignored.
        """
        anakot_root = tmp_path / ".anakot"
        anakot_root.mkdir(parents=True, exist_ok=True)

        result = _run_apply_profile_override(
            tmp_path,
            monkeypatch,
            anakot_home=str(anakot_root),
            active_profile="coder",
        )

        assert result is not None, "ANAKOT_HOME must be set after profile redirect"
        assert "profiles" in result, (
            f"Expected ANAKOT_HOME to point into profiles/ dir, got: {result!r}"
        )
        assert result.endswith("coder"), (
            f"Expected ANAKOT_HOME to end with 'coder', got: {result!r}"
        )

    def test_anakot_home_already_profile_dir_is_trusted(self, tmp_path, monkeypatch):
        """ANAKOT_HOME=.../profiles/coder must not be overridden even when
        active_profile says something different.

        Preserves the child-process inheritance contract: a subprocess spawned
        with ANAKOT_HOME already set to a specific profile must stay in that
        profile.
        """
        anakot_root = tmp_path / ".anakot"
        profile_dir = anakot_root / "profiles" / "coder"
        profile_dir.mkdir(parents=True, exist_ok=True)

        (anakot_root / "active_profile").write_text("other")

        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        monkeypatch.setenv("ANAKOT_HOME", str(profile_dir))
        monkeypatch.setattr(sys, "argv", ["anakot", "gateway", "start"])

        from anakot_cli.main import _apply_profile_override
        _apply_profile_override()

        assert os.environ.get("ANAKOT_HOME") == str(profile_dir), (
            "ANAKOT_HOME must remain unchanged when already pointing to a profile dir"
        )

    def test_anakot_home_unset_reads_active_profile(self, tmp_path, monkeypatch):
        """Classic case: ANAKOT_HOME unset + active_profile=coder must set
        ANAKOT_HOME to the profile directory (existing behaviour must not regress).
        """
        result = _run_apply_profile_override(
            tmp_path,
            monkeypatch,
            anakot_home=None,
            active_profile="coder",
        )

        assert result is not None
        assert "coder" in result

    def test_anakot_home_unset_default_profile_no_redirect(self, tmp_path, monkeypatch):
        """active_profile=default must not redirect ANAKOT_HOME."""
        anakot_root = tmp_path / ".anakot"
        anakot_root.mkdir(parents=True, exist_ok=True)

        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        monkeypatch.delenv("ANAKOT_HOME", raising=False)
        monkeypatch.setattr(sys, "argv", ["anakot", "gateway", "start"])
        (anakot_root / "active_profile").write_text("default")

        from anakot_cli.main import _apply_profile_override
        _apply_profile_override()

        assert os.environ.get("ANAKOT_HOME") is None
