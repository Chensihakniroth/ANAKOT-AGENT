"""``anakot dashboard register`` — removed in Anakot fork.

The callmemo Portal was a Hermes Agent / Nous Research service that does not
exist in the Anakot fork. Self-hosted dashboard OAuth client registration is
not needed since Anakot uses its own session-token auth for the dashboard.
"""

from __future__ import annotations

import sys


def cmd_dashboard_register(args) -> None:
    print(
        "✗ `anakot dashboard register` is not available in Anakot.\n"
        "  The callmemo Portal OAuth client registration is not part of Anakot.\n"
        "  The dashboard uses its own session-token auth — no portal registration needed.",
        file=sys.stderr,
    )
    sys.exit(1)
