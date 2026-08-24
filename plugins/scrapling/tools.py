"""Native Scrapling tools for Anakot.

In-process, key-free web scraping & crawling powered by Scrapling
(https://github.com/D4Vinci/Scrapling, BSD-3). No API key, no server.

- ``scrapling_scrape``: fetch one URL (http / stealth / dynamic) and return its
  text, or extract elements by CSS selector (adaptive selectors survive
  site redesigns).
- ``scrapling_crawl``: crawl a site from a start URL, collecting elements that
  match a CSS selector across up to ``max_pages`` same-domain pages.

Imports are mode-aware so plain ``http`` mode only needs ``curl_cffi`` (pulled
in by Scrapling), while ``stealth``/``dynamic`` modes additionally need
Playwright. Everything is lazy so the plugin loads even when the package or
its extras are missing; the handler then tells the user exactly what to
install.
"""
from __future__ import annotations

from tools.registry import tool_error, tool_result

_STRING = {"type": "string"}


def _load_core():
    """http-mode primitives (Fetcher). Scrapling's engine pulls in the
    playwright *package* even for http, so both scrapling and playwright
    must be installed."""
    try:
        from scrapling.fetchers import Fetcher
    except Exception as exc:
        return tool_error(
            "Scrapling isn't ready. Run: pip install scrapling playwright",
            detail=f"{type(exc).__name__}: {exc}",
        )
    return {"Fetcher": Fetcher}


def _load_browser():
    """stealth/dynamic fetchers. Need the Playwright chromium browser too."""
    try:
        from scrapling.fetchers import DynamicFetcher, StealthyFetcher
    except Exception as exc:
        return tool_error(
            "stealth/dynamic modes need the Playwright browser. Run: "
            "pip install playwright && playwright install chromium",
            detail=f"{type(exc).__name__}: {exc}",
        )
    return {"StealthyFetcher": StealthyFetcher, "DynamicFetcher": DynamicFetcher}


def _page_text(page) -> str:
    """Best-effort page text/markdown for LLM ingestion."""
    for attr in ("markdown", "text", "raw_text"):
        val = getattr(page, attr, None)
        if isinstance(val, str) and val.strip():
            return val
    try:
        body = page.css("body").get()
        if isinstance(body, str) and body.strip():
            return body
    except Exception:
        pass
    return str(page)


def _fetcher(mods: dict, mode: str):
    if mode == "stealth":
        return mods["StealthyFetcher"]
    if mode == "dynamic":
        return mods["DynamicFetcher"]
    return mods["Fetcher"]


def _handle_scrapling_scrape(args: dict, **kw) -> str:
    url = str(args.get("url") or "").strip()
    if not url:
        return tool_error("`url` is required")
    mode = str(args.get("mode") or "http").lower()
    if mode not in ("http", "stealth", "dynamic"):
        return tool_error("`mode` must be one of: http, stealth, dynamic")

    mods = _load_browser() if mode in ("stealth", "dynamic") else _load_core()
    if isinstance(mods, str):
        return mods

    try:
        if mode == "http":
            page = mods["Fetcher"].get(url)
        else:
            page = _fetcher(mods, mode).fetch(url)
    except Exception as exc:
        return tool_error(f"Scrapling failed to fetch {url}: {type(exc).__name__}: {exc}")

    selector = str(args.get("selector") or "").strip()
    if selector:
        adaptive = bool(args.get("adaptive"))
        try:
            matches = page.css(selector, adaptive=adaptive)
            items = [m.get() for m in matches]
        except Exception as exc:
            return tool_error(f"selector '{selector}' failed: {type(exc).__name__}: {exc}")
        return tool_result({
            "url": url, "mode": mode, "selector": selector,
            "adaptive": adaptive, "count": len(items), "items": items,
        })

    return tool_result({"url": url, "mode": mode, "content": _page_text(page)})


def _handle_scrapling_crawl(args: dict, **kw) -> str:
    start_url = str(args.get("start_url") or "").strip()
    if not start_url:
        return tool_error("`start_url` is required")
    mode = str(args.get("mode") or "http").lower()
    if mode not in ("http", "stealth", "dynamic"):
        return tool_error("`mode` must be one of: http, stealth, dynamic")

    mods = _load_browser() if mode in ("stealth", "dynamic") else _load_core()
    if isinstance(mods, str):
        return mods

    selector = str(args.get("selector") or "a").strip()
    try:
        max_pages = max(1, int(args.get("max_pages", 50) or 50))
    except (TypeError, ValueError):
        max_pages = 50

    from urllib.parse import urljoin, urlparse

    fetcher = _fetcher(mods, mode)
    base_host = urlparse(start_url).netloc
    visited: set[str] = set()
    collected: list[str] = []
    queue = [start_url]

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            if mode == "http":
                page = mods["Fetcher"].get(url)
            else:
                page = _fetcher(mods, mode).fetch(url)
        except Exception:
            continue
        try:
            for el in page.css(selector):
                try:
                    collected.append(el.get())
                except Exception:
                    pass
        except Exception:
            pass
        # Enqueue same-domain links for further crawling.
        try:
            for href in page.css("a::attr(href)").getall():
                abs_url = urljoin(url, href)
                if urlparse(abs_url).netloc == base_host and abs_url not in visited:
                    queue.append(abs_url)
        except Exception:
            pass

    return tool_result({
        "start_url": start_url, "mode": mode, "selector": selector,
        "max_pages": max_pages, "pages_visited": len(visited),
        "count": len(collected), "items": collected,
    })


SCRAPE_SCHEMA = {
    "name": "scrapling_scrape",
    "description": (
        "Fetch a URL with Scrapling and return its content, or extract elements by "
        "CSS selector. mode='http' (default) is key-free pure HTTP (needs curl_cffi); "
        "mode='stealth' beats anti-bot/Cloudflare; mode='dynamic' drives a real "
        "browser for JS-heavy pages (both need Playwright). Pass `selector` to scrape "
        "structured elements; set adaptive=true so selectors survive future site "
        "redesigns."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "url": _STRING,
            "mode": {"type": "string", "enum": ["http", "stealth", "dynamic"]},
            "selector": _STRING,
            "adaptive": {"type": "boolean"},
        },
        "required": ["url"],
    },
}

CRAWL_SCHEMA = {
    "name": "scrapling_crawl",
    "description": (
        "Crawl a website from start_url, collecting elements matching `selector` "
        "(default 'a') across up to max_pages same-domain pages. In-process, no API key."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "start_url": _STRING,
            "selector": _STRING,
            "mode": {"type": "string", "enum": ["http", "stealth", "dynamic"]},
            "max_pages": {"type": "integer"},
        },
        "required": ["start_url"],
    },
}
