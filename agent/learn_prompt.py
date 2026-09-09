"""Skill-distillation prompt builder for ``/learn``.

Given a user's description of what to learn from (conversation, directory, URL,
free-form notes), constructs a meta-prompt that instructs the agent to analyze the
source material and synthesize a clean, reusable skill under ``~/.anakot/skills/``.

This is **not** the agent that does the learning — it builds the prompt that
the agent receives as its next user turn, which triggers skill generation.
"""

from __future__ import annotations

import textwrap
from typing import Optional

from anakot_constants import display_anakot_home


def build_learn_prompt(
    user_request: str,
    *,
    from_chat: bool = False,
    from_dir: Optional[str] = None,
    from_url: Optional[str] = None,
) -> str:
    """Return the synthetic user message injected by ``/learn``.

    Parameters
    ----------
    user_request:
        Free-form description of what to learn.  May be empty when
        ``from_chat=True`` (learn from the current conversation).
    from_chat:
        When true, the conversation history is the primary source material.
    from_dir:
        Absolute path to a directory to learn from (e.g. a codebase).
    from_url:
        URL to learn from (e.g. documentation page).
    """

    skills_dir = f"{display_anakot_home()}/skills"

    source_clauses: list[str] = []
    if from_chat:
        source_clauses.append(
            "Analyze the **current conversation history** as the primary source material."
        )
    if from_dir:
        source_clauses.append(
            f"Analyze the directory **`{from_dir}`** — scan its structure, key files, "
            f"and patterns as source material."
        )
    if from_url:
        source_clauses.append(
            f"Fetch and analyze the content at **{from_url}** as source material."
        )
    if not source_clauses:
        source_clauses.append(
            "Use the description below and any relevant conversation context "
            "as source material."
        )

    sources_block = "\n".join(f"- {clause}" for clause in source_clauses)

    user_description = user_request.strip() if user_request.strip() else "(learn from the current context)"

    return textwrap.dedent(f"""\
        You are being asked to **learn a reusable skill** from the following sources and description.

        ## Sources
        {sources_block}

        ## User's Description
        {user_description}

        ## Instructions

        1. **Analyze** the source material thoroughly. Identify the core workflow, patterns,
           decisions, and domain knowledge that would be valuable to preserve.

        2. **Synthesize** a clean, focused skill that captures this knowledge. The skill should:
           - Have a clear, descriptive name (lowercase-with-hyphens)
           - Include a concise but complete ``SKILL.md`` with YAML frontmatter
           - Capture the **why** (rationale, tradeoffs) not just the **what** (steps)
           - Include concrete examples where helpful
           - Be general enough to apply to similar future situations

        3. **Write** the skill to ``{skills_dir}/<skill-name>/SKILL.md`` using the
           ``create_file`` tool. The SKILL.md must have this structure:

           ```markdown
           ---
           name: skill-name
           description: One-line description of what this skill teaches
           ---

           # Skill Title

           ## When to Use
           Describe the trigger conditions for this skill.

           ## Instructions
           Step-by-step guidance, patterns, and key decisions.

           ## Examples
           Concrete examples if applicable.

           ## Pitfalls
           Common mistakes and how to avoid them.
           ```

        4. **Confirm** to the user what you learned and where the skill was saved.

        Do NOT ask for clarification — work with what you have. If the source material
        is thin, produce a focused micro-skill rather than padding with generic advice.
    """)


def parse_learn_args(raw_args: str) -> dict:
    """Parse ``/learn`` arguments into structured fields.

    Supports:
    - ``/learn`` (empty → learn from chat)
    - ``/learn <description>``
    - ``/learn --from-dir /path/to/dir <description>``
    - ``/learn --from-url https://... <description>``
    - ``/learn --from-chat <description>``
    """
    import shlex

    result = {
        "from_chat": False,
        "from_dir": None,
        "from_url": None,
        "user_request": "",
    }

    if not raw_args.strip():
        result["from_chat"] = True
        return result

    try:
        tokens = shlex.split(raw_args)
    except ValueError:
        tokens = raw_args.split()

    remaining: list[str] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok == "--from-chat":
            result["from_chat"] = True
        elif tok == "--from-dir" and i + 1 < len(tokens):
            i += 1
            result["from_dir"] = tokens[i]
        elif tok == "--from-url" and i + 1 < len(tokens):
            i += 1
            result["from_url"] = tokens[i]
        else:
            remaining.append(tok)
        i += 1

    result["user_request"] = " ".join(remaining)

    # If nothing explicit, infer from-chat when no dir/url given
    if not result["from_chat"] and not result["from_dir"] and not result["from_url"]:
        result["from_chat"] = True

    return result
