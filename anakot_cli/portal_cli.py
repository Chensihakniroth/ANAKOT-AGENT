"""``anakot portal`` — removed in Anakot fork.

The callmemo Portal was a Hermes Agent / Nous Research service that does not
exist in the Anakot fork. This command is kept as a stub so that any scripted
references to `anakot portal` fail gracefully with a clear message instead of
an import error.
"""

from __future__ import annotations

import sys


def portal_command(args) -> int:
    print(
        "The callmemo Portal is not part of Anakot. "
        "Use `anakot model` to pick a provider (OpenRouter, etc.) and "
        "configure API keys directly.",
        file=sys.stderr,
    )
    return 1


def add_parser(subparsers) -> None:
    portal_parser = subparsers.add_parser(
        "portal",
        help="[removed] callmemo Portal — not available in Anakot",
        description=(
            "The callmemo Portal was a Hermes Agent / Nous Research service "
            "that is not part of the Anakot fork. Use `anakot model` to pick "
            "a provider and configure API keys directly."
        ),
    )
    portal_parser.set_defaults(func=portal_command)
