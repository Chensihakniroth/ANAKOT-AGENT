"""Tests for ``anakot dashboard register`` — removed in Anakot fork.

The callmemo Portal OAuth client registration is not part of Anakot.
These tests verify the stub fails gracefully.
"""

from __future__ import annotations

import argparse

import pytest

import anakot_cli.dashboard_register as dr


def _ns(**kw):
    defaults = dict(name=None, redirect_uri=None)
    defaults.update(kw)
    return argparse.Namespace(**defaults)


class TestStub:
    def test_exits_1_with_message(self, capsys):
        with pytest.raises(SystemExit) as exc:
            dr.cmd_dashboard_register(_ns())
        assert exc.value.code == 1
        err = capsys.readouterr().err
        assert "not available" in err.lower() or "not part of anakot" in err.lower()
