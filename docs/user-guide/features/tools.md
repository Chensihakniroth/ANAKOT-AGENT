# Tools & Toolsets — Anakot Agent

> Tools are functions that extend the agent's capabilities. They're organized into logical toolsets that can be enabled or disabled per platform.

## Available Tools

Anakot ships with a broad built-in tool registry covering web search, browser automation, terminal execution, file editing, memory, delegation, messaging delivery, Home Assistant, and more.

### High-level Categories

| Category | Examples | Description |
|----------|----------|-------------|
| **Web** | `web_search`, `web_extract` | Search the web and extract page content. |
| **Terminal & Files** | `terminal`, `process`, `read_file`, `patch`, `search_files` | Execute commands and manipulate files. |
| **Browser** | `browser_navigate`, `browser_snapshot`, `browser_click` | Interactive browser automation with text and vision support. |
| **Media** | `vision_analyze`, `image_generate`, `text_to_speech` | Multimodal analysis and generation. |
| **Agent orchestration** | `todo`, `clarify`, `execute_code`, `delegate_task` | Planning, clarification, code execution, and subagent delegation. |
| **Memory & recall** | `memory`, `session_search` | Persistent memory and session search. |
| **Automation & delivery** | `cronjob`, `send_message` | Scheduled tasks plus outbound messaging delivery. |
| **Integrations** | `ha_*`, MCP server tools | Home Assistant, MCP, and other integrations. |

## Using Toolsets

```bash
# Use specific toolsets
anakot chat --toolsets "web,terminal"

# See all available tools
anakot tools

# Configure tools per platform (interactive)
anakot tools
```

Common toolsets include: `web`, `search`, `terminal`, `file`, `browser`, `vision`, `image_gen`, `skills`, `tts`, `todo`, `memory`, `session_search`, `cronjob`, `code_execution`, `delegation`, `clarify`, `homeassistant`, `messaging`, `spotify`, `discord`, `discord_admin`, `debugging`, `feishu_doc`, `feishu_drive`, `kanban`, `video`, `video_gen`, `x_search`, `yuanbao`.

## Toolsets Reference

| Toolset | Tools | Description |
|---------|-------|-------------|
| `terminal` | `terminal`, `process` | Shell command execution, background process management |
| `file` | `read_file`, `write_file`, `patch`, `search_files` | File read/write/edit/search |
| `web` | `web_search`, `web_extract` | Web search and content extraction |
| `browser` | `browser_*` (10+ tools) | Full browser automation |
| `vision` | `vision_analyze` | Image analysis |
| `image_gen` | `image_generate` | Image generation |
| `tts` | `text_to_speech` | Text-to-speech |
| `memory` | `memory` | Persistent memory management |
| `session_search` | `session_search` | Cross-session search (FTS5) |
| `cronjob` | `cronjob` | Scheduled task management |
| `code_execution` | `execute_code` | Python code execution sandbox |
| `delegation` | `delegate_task` | Subagent spawning |
| `skills` | `skill_view`, `skill_manage`, `skills_list` | Skill lifecycle management |
| `todo` | `todo` | Task list management |
| `clarify` | `clarify` | User clarification prompts |
| `messaging` | `send_message` | Outbound message delivery |
| `homeassistant` | `ha_*` | Home Assistant integration |
| `discord` | Discord tools | Discord platform integration |
| `feishu_doc` | Feishu doc tools | Feishu/Lark document integration |
| `feishu_drive` | Feishu drive tools | Feishu/Lark drive integration |
| `kanban` | Kanban tools | Multi-agent kanban board |
| `spotify` | Spotify tools | Spotify integration |
| `x_search` | X/Twitter search | X/Twitter search via xAI |
| `yuanbao` | Yuanbao tools | Yuanbao (元宝) group integration |

## Terminal Backends

The `terminal` tool can execute commands in different environments:

| Backend | Description | Use Case |
|---------|-------------|----------|
| `local` | Run on your machine (default) | Development, trusted tasks |
| `docker` | Isolated containers | Security, reproducibility |
| `ssh` | Remote server | Sandboxing, keep agent away from its own code |
| `singularity` | HPC containers | Cluster computing, rootless |
| `modal` | Cloud execution | Serverless, scale |
| `daytona` | Cloud sandbox workspace | Persistent remote dev environments |

```yaml
# In ~/.anakot/config.yaml
terminal:
  backend: local    # or: docker, ssh, singularity, modal, daytona
  cwd: "."
  timeout: 180
```

## Background Process Management

Start background processes and manage them:

```python
# Start a background process
terminal(command="pytest -v tests/", background=True)
# Returns: {"session_id": "proc_abc123", "pid": 12345}

# Then manage with the process tool:
process(action="list")                           # Show all running
process(action="poll", session_id="proc_abc123") # Check status
process(action="wait", session_id="proc_abc123") # Block until done
process(action="log", session_id="proc_abc123")  # Full output
process(action="kill", session_id="proc_abc123") # Terminate
```

PTY mode (`pty=true`) enables interactive CLI tools like Codex and Claude Code.

## Adding a New Tool

Built-in/core tools require changes in **2 files**:

**1. Create `tools/your_tool.py`:**

```python
from tools.registry import registry

def example_tool(param: str, task_id: str = None) -> str:
    return json.dumps({"success": True, "data": "..."})

registry.register(
    name="example_tool",
    toolset="example",
    schema={"name": "example_tool", "description": "...", "parameters": {...}},
    handler=lambda args, **kw: example_tool(param=args.get("param", ""), task_id=kw.get("task_id")),
    requires_env=["EXAMPLE_API_KEY"],
)
```

**2. Add to `toolsets.py`** — either `_ANAKOT_CORE_TOOLS` or a new toolset.

Auto-discovery: any `tools/*.py` file with a top-level `registry.register()` call is imported automatically.

## See Also

- **[[Configuration]]** — Config file, providers, models, options
- **[[Skills System]]** — Procedural memory the agent creates and reuses
- **[[CLI Guide]]** — Classic prompt_toolkit CLI interface
- **[[Architecture]]** — How it works under the hood
