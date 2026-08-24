"""Scrapling integration plugin — bundled, auto-loaded.

Registers two tools (``scrapling_scrape``, ``scrapling_crawl``) into the
``scrapling`` toolset. The toolset appears in Settings → Tool Backends and the
Skills toggle list, where it can be switched on/off per platform. Scrapling
itself is imported lazily inside each handler, so the plugin loads even when
the package is not yet installed.
"""
from __future__ import annotations

from plugins.scrapling.tools import (
    CRAWL_SCHEMA,
    SCRAPE_SCHEMA,
    _handle_scrapling_crawl,
    _handle_scrapling_scrape,
)

_TOOLS = (
    ("scrapling_scrape", SCRAPE_SCHEMA, _handle_scrapling_scrape, "🕷️"),
    ("scrapling_crawl", CRAWL_SCHEMA, _handle_scrapling_crawl, "🕸️"),
)


def register(ctx) -> None:
    """Register all Scrapling tools. Called once by the plugin loader."""
    for name, schema, handler, emoji in _TOOLS:
        ctx.register_tool(
            name=name,
            toolset="scrapling",
            schema=schema,
            handler=handler,
            emoji=emoji,
        )
