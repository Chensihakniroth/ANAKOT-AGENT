"""Tests for agent.portal_tags — callmemo Portal request tag contract."""

from __future__ import annotations


def test_anakot_client_tag_includes_current_version():
    """The client tag must reflect anakot_cli.__version__ verbatim."""
    from anakot_cli import __version__
    from agent.portal_tags import anakot_client_tag

    assert anakot_client_tag() == f"client=anakot-client-v{__version__}"


def test_anakot_client_tag_format():
    """The client tag has the exact shape callmemo Portal expects."""
    from agent.portal_tags import anakot_client_tag

    tag = anakot_client_tag()
    assert tag.startswith("client=anakot-client-v")
    # No spaces, no commas — single tag value
    assert " " not in tag
    assert "," not in tag


def test_callmemo_portal_tags_contains_product_and_client():
    """Every callmemo Portal request gets BOTH the product tag and the version tag."""
    from agent.portal_tags import anakot_client_tag, callmemo_portal_tags

    tags = callmemo_portal_tags()
    assert "product=anakot-agent" in tags
    assert anakot_client_tag() in tags
    assert len(tags) == 2


def test_callmemo_portal_tags_returns_fresh_list():
    """Callers mutate the returned list; we must not share state across calls."""
    from agent.portal_tags import callmemo_portal_tags

    a = callmemo_portal_tags()
    a.append("client=test-mutation")
    b = callmemo_portal_tags()
    assert "client=test-mutation" not in b


def test_auxiliary_client_nous_extra_body_uses_helper():
    """auxiliary_client.NOUS_EXTRA_BODY must match the canonical helper output."""
    from agent.auxiliary_client import NOUS_EXTRA_BODY
    from agent.portal_tags import callmemo_portal_tags

    assert NOUS_EXTRA_BODY == {"tags": callmemo_portal_tags()}


def test_nous_provider_profile_uses_helper():
    """The callmemo provider profile (main agent loop) must use the canonical tags."""
    from agent.portal_tags import callmemo_portal_tags
    from providers import get_provider_profile

    profile = get_provider_profile("nous")
    assert profile is not None
    body = profile.build_extra_body()
    assert body["tags"] == callmemo_portal_tags()
