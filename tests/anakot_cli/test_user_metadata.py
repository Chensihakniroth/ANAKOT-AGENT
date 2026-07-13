"""Tests for the user_metadata module."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest


# Bring module into scope after clearing its cache
@pytest.fixture(autouse=True)
def _clear_cache():
    import anakot_cli.dashboard_auth.user_metadata as um
    um._CACHE = None
    yield


@pytest.fixture
def um():
    """Import and return the module with a temp metadata path."""
    import anakot_cli.dashboard_auth.user_metadata as um
    return um


def test_default_role_is_user(tmp_path: Path, um):
    """A user not in the metadata file defaults to 'user'."""
    with patch.object(um, "_metadata_path", return_value=tmp_path / "user-metadata.json"):
        um._CACHE = None
        assert um.get_user_role("unknown-user") == "user"
        assert um.is_admin("unknown-user") is False


def test_set_and_get_role(tmp_path: Path, um):
    with patch.object(um, "_metadata_path", return_value=tmp_path / "user-metadata.json"):
        um._CACHE = None
        um.set_user_role("google-12345", "admin")
        assert um.get_user_role("google-12345") == "admin"
        assert um.is_admin("google-12345") is True

        um.set_user_role("google-12345", "user")
        assert um.is_admin("google-12345") is False


def test_list_all_users(tmp_path: Path, um):
    with patch.object(um, "_metadata_path", return_value=tmp_path / "user-metadata.json"):
        um._CACHE = None
        um.set_user_role("user-a", "admin")
        um.set_user_role("user-b", "user")

        all_users = um.list_all_users()
        assert all_users["user-a"]["role"] == "admin"
        assert all_users["user-b"]["role"] == "user"


def test_invalid_role_raises(tmp_path: Path, um):
    with patch.object(um, "_metadata_path", return_value=tmp_path / "user-metadata.json"):
        um._CACHE = None
        with pytest.raises(ValueError, match="Invalid role"):
            um.set_user_role("x", "superadmin")


def test_persistence_across_reload(tmp_path: Path, um):
    """Data written survives cache clear + reload."""
    meta_path = tmp_path / "user-metadata.json"
    with patch.object(um, "_metadata_path", return_value=meta_path):
        um._CACHE = None
        um.set_user_role("persist-user", "admin")

        # Simulate module reload by clearing cache
        um._CACHE = None

        assert um.is_admin("persist-user") is True
        # Verify file on disk
        data = json.loads(meta_path.read_text())
        assert data["persist-user"]["role"] == "admin"


def test_get_metadata(tmp_path: Path, um):
    with patch.object(um, "_metadata_path", return_value=tmp_path / "user-metadata.json"):
        um._CACHE = None
        um.set_user_role("meta-user", "admin")
        meta = um.get_metadata("meta-user")
        assert meta["role"] == "admin"


def test_unknown_user_returns_empty_metadata(tmp_path: Path, um):
    with patch.object(um, "_metadata_path", return_value=tmp_path / "user-metadata.json"):
        um._CACHE = None
        assert um.get_metadata("nobody") == {}
