"""Regression for #21454: re-running install.sh on a symlinked prior install.

Older versions of ``install.sh`` created ``$link_dir/anakot`` as a
symlink to the pip-generated entry point at ``$anakot_bin`` (i.e.
``venv/bin/anakot``). When ``setup_path()`` later switched to writing a bash
shim with ``cat > "$link_dir/anakot" <<EOF``, the redirect followed
the existing symlink and overwrote the pip entry point with the shim. The
shim's ``exec "$anakot_bin" "$@"`` then self-recursed and ``anakot`` hung on
every invocation.

These tests pin the fix: ``setup_path()`` must remove ``$link_dir/anakot``
before writing through the redirect, so the shim is created as a regular file
in ``link_dir`` and the venv entry point is left intact.

The fork resolves the link dir through ``get_command_link_dir()`` (exposed as
``$link_dir``) and writes the launcher from ``$anakot_bin``, so the behavioral
repro below drives the extracted block with those names rather than the old
``$command_link_dir`` / ``$ANAKOT_BIN`` globals.
"""

from __future__ import annotations

import re
import stat
import subprocess
from pathlib import Path



REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "scripts" / "install.sh"


def _extract_setup_path_shim_block() -> str:
    """Return the install.sh shim-write block used by setup_path().

    The fork renamed the link-dir variable from ``$command_link_dir`` to
    ``$link_dir`` (resolved via ``get_command_link_dir()``), so the pattern
    must track the current spelling.
    """
    text = INSTALL_SH.read_text()
    match = re.search(
        r"(?P<block>mkdir -p \"\$link_dir\".*?chmod \+x \"\$link_dir/anakot\")",
        text,
        re.DOTALL,
    )
    assert match is not None, (
        "Could not locate the setup_path shim-write block in scripts/install.sh"
    )
    return match["block"]


def test_setup_path_shim_block_removes_old_link_before_writing() -> None:
    """Static guard: the rm must precede the cat heredoc, not follow it."""
    block = _extract_setup_path_shim_block()
    rm_idx = block.find('rm -f "$link_dir/anakot"')
    cat_idx = block.find('cat > "$link_dir/anakot" <<EOF')
    assert rm_idx != -1, (
        "setup_path() must `rm -f` $link_dir/anakot before the "
        "`cat >` heredoc, otherwise an existing symlink (left by older "
        "installs) will be followed and the pip entry point overwritten. "
        "See #21454."
    )
    assert cat_idx != -1, "expected `cat >` heredoc still present"
    assert rm_idx < cat_idx, (
        "`rm -f` must come *before* the `cat >` heredoc, not after."
    )


def test_re_running_setup_path_block_preserves_pip_entry_point(tmp_path: Path) -> None:
    """Behavioral repro: simulate prior-install symlink + new-install heredoc.

    Layout mirrors a real install:

        tmp/
          venv/bin/anakot        <- pip entry point (the one we must preserve)
          local_bin/anakot       <- symlink → ../venv/bin/anakot  (old install)

    Then we run the exact shim-write block from setup_path() with
    ``anakot_bin`` and ``get_command_link_dir`` pointed at this fixture. The
    fix requires that, after the run:

      * ``venv/bin/anakot`` still contains its original pip-script body
      * ``local_bin/anakot`` is a regular file (not a symlink) holding the shim
    """
    venv_bin = tmp_path / "venv" / "bin"
    venv_bin.mkdir(parents=True)
    pip_entry = venv_bin / "anakot"
    pip_marker = "#!/usr/bin/env python\n# pip-generated entry point — must not be overwritten\n"
    pip_entry.write_text(pip_marker)
    pip_entry.chmod(pip_entry.stat().st_mode | stat.S_IXUSR)

    command_link_dir = tmp_path / "local_bin"
    command_link_dir.mkdir()
    shim_path = command_link_dir / "anakot"
    # Reproduce the prior-install state: shim path is a symlink to the
    # pip-generated entry point.
    shim_path.symlink_to(pip_entry)
    assert shim_path.is_symlink()

    block = _extract_setup_path_shim_block()
    # Drive the current block: setup_path() resolves the link dir via
    # get_command_link_dir() and writes the launcher from $anakot_bin.
    # Override the resolver and point $anakot_bin at the preserved pip entry.
    # The block declares `local link_dir`, so wrap it in a function to keep
    # `local` valid under `bash -c`.
    pip_entry_posix = pip_entry.as_posix()
    script = (
        f'set -e\n'
        f'anakot_bin={pip_entry_posix}\n'
        f'get_command_link_dir() {{ echo {command_link_dir.as_posix()}; }}\n'
        f'run_block() {{\n{block}\n}}\n'
        f'run_block\n'
    )
    result = subprocess.run(
        ["bash", "-c", script],
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
    assert result.returncode == 0, (
        f"shim-write block failed:\nstdout={result.stdout}\nstderr={result.stderr}"
    )

    # The pip entry point must still be the original pip script — not a
    # re-written self-recursing bash shim.
    assert pip_entry.read_text() == pip_marker, (
        "venv/bin/anakot was overwritten by setup_path() — symlink-stomp "
        "regression (#21454)."
    )

    # The shim path itself must now be a regular file holding the launcher.
    assert shim_path.exists()
    assert not shim_path.is_symlink(), (
        "link_dir/anakot must be replaced with a regular file, not "
        "left as a symlink — otherwise the next install will stomp again."
    )
    shim_text = shim_path.read_text()
    assert "unset PYTHONPATH" in shim_text
    assert "unset PYTHONHOME" in shim_text
    assert f'exec "{pip_entry_posix}"' in shim_text
    shim_mode = shim_path.stat().st_mode
    assert shim_mode & stat.S_IXUSR, "shim must be user-executable"
