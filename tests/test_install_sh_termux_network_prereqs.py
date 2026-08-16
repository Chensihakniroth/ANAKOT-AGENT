"""Regression tests for install.sh network connectivity probe.

The fork replaced the old ``check_network_prerequisites()`` (which carried
Termux-specific repo/CA guidance) with a single ``check_network()`` probe that
verifies outbound reachability to PyPI before the dependency install stage.
Termux package installation is now handled inline via ``pkg install`` calls
rather than a single ``termux_pkgs`` array, so this module only pins the
PyPI connectivity probe that ``main()`` still invokes.
"""

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "scripts" / "install.sh"


def test_install_script_has_pypi_connectivity_probe() -> None:
    text = INSTALL_SH.read_text()
    # check_network() must exist and actually probe pypi.org before deps.
    assert "check_network()" in text
    assert "https://pypi.org/simple/" in text
    # The probe must be invoked by main().
    assert "    check_network\n" in text
