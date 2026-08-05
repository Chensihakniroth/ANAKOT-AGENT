# Hermes Agent vs Anakot Agent — Full Feature Comparison

> **Generated:** 2026-08-04 · **Anakot HEAD:** `6d3c8e1bc` (main) · **Hermes upstream:** `NousResearch/hermes-agent@main`
> **Method:** Exhaustive inventory of both codebases (CLI registry, `agent/`, `tools/`, `gateway/`, `plugins/`, `skills/`, `apps/desktop`, `tui_gateway` RPC), cross-verified against Anakot source.
> **Legend:** ✅ present · ❌ missing · 🔶 partial / present in reduced form · 🆕 Anakot-only (Hermes doesn't have it)

---

## 0. TL;DR

Anakot is a fork of Hermes Agent. It shares ~90% of the core (agent loop, tools, gateway, desktop, pets, kanban, cron, MCP/ACP/LSP, skills). The gaps concentrate in:

1. **Nous-cloud features** (stripped by design): Nous billing (`/subscription`, `/topup`, `billing.*` RPC), Nous portal auth, `nous`/`drain` dashboard auth, `subscription.*` RPC, `usage` banked-reset.
2. **Learning/Journey graph** — present as code + web API + starmap UI, but **NOT wired into the agent loop** (no `/journey`, no `learning.*` RPC, no agent-turn integration).
3. **20 CLI commands** missing (`/prompt`, `/diff`, `/journey`, `/learn`, `/init`, `/moa`, `/pet`, `/hatch`, `/wake`, `/focus`, `/battery`, `/timestamps`, `/context`, `/approvals`, `/memory`, `/egress`, `/suggestions`, `/blueprint`, `/subscription`, `/topup`).
4. **Model provider catalog** — 8 provider plugins vs Hermes' 33 (many still reachable via generic chat_completions/custom, but not preconfigured).
5. **Desktop gaps** — projects/worktrees, quick-entry, wake-indicator, reactions, learning journey page, marketplace themes, webhooks page, window effects (translucency/ambient), notifications settings.
6. **Platform adapters** — missing `a2a`, `buzz`, `raft`, `photon`, `whatsapp_cloud`.
7. **RPC surface** — 90 handlers vs 131: no `billing.*`, `learning.*`, `projects.*`, `verification.*`, `wake.*`, `usage.bars`, `llm.oneshot`, `system.battery`, `message.react`, `pdf.attach`, `file.attach`, `handoff.*`, `terminal.read.respond`.

**Anakot-only (superset):** Web dashboard (181 routes) + full WEB_VERSION web app, NotebookLLM, Discord Rich Presence, multi-user admin/grants, `gquota`, `obsidian_graph_scan` tool, Windows-native installers/bootstrap, Railway/docker-compose.windows, mobile responsive web, `auto-read-aloud`/haptics/mobile shell in desktop, ponytail agent kit, callmemo provider + account/subscription.

---

## 1. ❌ MISSING IN ANAKOT (Hermes has it, Anakot doesn't)

### 1.1 CLI / Slash commands (20)

| Command | Purpose |
|---|---|
| `/prompt` (alias `compose`) | Compose next prompt in `$EDITOR` (markdown) |
| `/journey` (aliases `learning`, `memory-graph`) | Open the learning-journey timeline (`list\|delete\|edit`) |
| `/moa` | Run one prompt through the Mixture-of-Agents preset, then restore model |
| `/learn` | Learn a reusable skill from anything you describe (dirs, URLs, chat, notes) |
| `/init` | Generate/update AGENTS.md project instructions from a repo scan |
| `/pet` | Toggle/adopt a petdex mascot from the CLI (`list\|scale\|off`) |
| `/hatch` (alias `generate-pet`) | Generate a new petdex pet from a description (CLI) |
| `/diff` | Show git changes in the working directory (`staged\|all\|session`, `--stat`) |
| `/context` (alias `ctx`) | Detailed context-window view (usage gauge, category breakdown, compression stats, throughput) |
| `/egress` | Show Docker egress proxy status |
| `/battery` | Toggle color-coded battery indicator in status bar |
| `/timestamps` (alias `ts`) | Toggle `[HH:MM]` timestamps in transcript |
| `/focus` | Toggle focus view (only prompt + final response) |
| `/approvals` | Set persistent approval mode (`manual\|smart\|off`) |
| `/memory` | Review pending memory writes / toggle the memory approval gate |
| `/wake` | Toggle "Hey Hermes" wake-word listener |
| `/suggestions` (alias `suggest`) | Review suggested automations (`accept\|dismiss\|catalog\|clear`) |
| `/blueprint` (alias `bp`) | Set up automation from a blueprint template |
| `/subscription` (alias `upgrade`) | View Nous plan / change in browser *(Nous-cloud; callmemo equivalents exist via `anakot portal_cli` / auth)* |
| `/topup` | Show Nous balance / manage billing on portal *(Nous-cloud)* |

> Verified: `grep -oP 'CommandDef\(\s*"\K[a-z0-9_-]+' anakot_cli/commands.py` yields 66 names; none of the above present.

### 1.2 Agent core subsystems

| Feature | Hermes impl | Notes |
|---|---|---|
| Learning graph wired into agent loop | `learning_graph.py`, `learning_mutations.py`, `learn_prompt.py` + `/journey` + `learning.*` RPC | Anakot has the graph + starmap UI + web API, but **0 references in `run_agent.py`** — the agent never consults/updates it during turns |
| Verification / bounded responses | `bounded_response.py`, `verification_evidence.py`, `verification_stop.py`, `verify_hooks.py`, `verification.status` RPC | Missing entirely |
| Reasoning timeouts | `reasoning_timeouts.py`, `thinking_timeout_guidance.py` | Anakot has `think_scrubber` + `lmstudio_reasoning` only |
| Secret sources | `secret_sources/{bitwarden,onepassword,command,registry,cache}` | Anakot has **only** `bitwarden.py` |
| Agent monitoring | `agent/monitoring/` (OTLP exporter, cron health, gateway health, policy, redaction) | Anakot has `plugins/observability` (langfuse/nemo_relay) but no `agent/monitoring/` dir |
| Relay runtime (multi-connection subagent relay) | `relay_llm.py`, `relay_runtime.py`, `relay_tools.py`, `gateway/relay/` (websocket transport, auth, media, descriptor) | Missing entirely (Anakot has `spawn_tree.*` RPC but no relay transport) |
| Turn machinery (finalizer/retry/summary) | `turn_finalizer.py`, `turn_retry_state.py`, `turn_summary.py`, `session_activity.py` | Partially covered by `conversation_loop.py`; dedicated modules missing |
| Reactions engine | `reactions.py` + `react_to_message` tool + `message.react` RPC + `reactions*.ts` stores | Missing entirely |
| Battery indicator | `battery.py` + `system.battery` RPC + statusbar battery | Missing entirely |
| Nous billing/credits plumbing | `billing_usage.py`, `billing_links.py`, `billing_view.py`, `subscription_view.py`, `credits_tracker.py` | Anakot has `credits_tracker`/`account_usage`/`callmemo_rate_guard`/`usage_pricing` (adapted) — cloud-billing views missing |

### 1.3 Tools (18)

| Tool | Purpose |
|---|---|
| `read_terminal` | Read the embedded terminal pane (desktop) |
| `close_terminal` | Close the agent's read-only terminal tab (desktop) |
| `react_to_message` | Emoji reactions on messages |
| `project_list` / `project_create` / `project_switch` | Desktop project tools |
| `focus_pane` / `open_preview` | Desktop pane/preview control tools |
| `xai_video_edit` / `xai_video_extend` | xAI video editing/extending |
| `bfl_flux3_text_to_image` / `bfl_flux3_text_to_video` / `bfl_flux3_keyframes_to_video` / `bfl_flux3_video_continuation` / `bfl_flux3_get_result` / `bfl_flux3_prompting_guide` | Black Forest Labs FLUX3 suite |
| `kanban_attach` / `kanban_attach_url` / `kanban_attachments` | Kanban attachment tools |

### 1.4 Gateway platforms (6)

| Platform | Notes |
|---|---|
| `a2a` | Agent2Agent protocol adapter + tools + security |
| `buzz` | Buzz (nostr auth) |
| `raft` | Raft platform |
| `photon` | Photon sidecar node (auth, CLI) |
| `whatsapp_cloud` | WhatsApp **Cloud API** adapter (Anakot has the non-cloud pairing `whatsapp` adapter only) |
| `gateway/relay/` | Gateway relay websocket transport (adapter/auth/media/descriptor) |

### 1.5 Desktop app (Electron + React)

| Feature | Notes |
|---|---|
| Projects / worktrees | `chat/sidebar/projects/` (workspace-groups, project-dialog, base-branch-picker, worktree-dialog, workspace-header) + `projects.ts` store + `projects.*` RPC + `project.facts` — Anakot has profiles but **no projects subsystem** |
| Quick-entry popup | `quick-entry/` route + `quick-entry.ts` store + Electron `quick-entry.cjs` + quick-entry settings |
| Wake indicator app | `wake-indicator/` route + `wake-word.ts` store (ties to missing wake word) |
| Learning journey page | `learning/` app (journey timeline, archive-skill dialog) — Anakot has only the starmap visualization |
| Webhooks page | `webhooks/` route — Anakot has webhook CLI + REST but no desktop UI route |
| Marketplace themes page | `command-palette/marketplace-theme-page.tsx` |
| Reactions UI | `reactions.ts`, `reactions-local`, `reactions-enabled` stores |
| Floating HUD | `floating-hud.tsx` module + `HUD_ITEM`/`HUD_TEXT` |
| Contrib panes/surfaces | `contrib/` (panes, surfaces, wiring, controller, latest-actions) |
| Window effects | `translucency`, `ambient`, `backdrop`, `zoom` gateway stores |
| Billing UI | `billing/` settings + `billing-block.ts` store |
| Memory settings UI | `settings/memory/` |
| Notifications settings | `settings/notifications-settings.tsx` |
| SSH remote bootstrap (Electron) | `ssh-bootstrap-coordinator`, `ssh-config`, `ssh-connection` (Anakot has SSH *environment* backend but no desktop remote-bootstrap) |
| Git worktree ops (Electron) | `git-worktree-ops` (Anakot has git channels but no worktree IPC) |
| Native OAuth (Electron) | `native-oauth`, `native-oauth-login`, `native-token-store`, `native-auth-decisions` |
| Find in page | `find-in-page.ts` store + Electron `find-in-page.cjs` |
| Goals store | `goals.ts` (CLI `/goal` works, but no desktop store/UI wiring) |
| Voice prefs store | `voice-prefs` (Anakot has `voice-playback` + mic access only) |
| Completion sound | `completion-sound` store |
| Embed consent | `embed-consent.ts` |
| Settings: `computer-use-panel`, `voice-provider-fields`, `ssh-host-selection`, `fallback-models-field`, `custom-endpoints-settings`, `quick-entry-settings` | Hermes-only settings sections |

### 1.6 TUI gateway RPC methods (missing from Anakot's 90)

| Group | Missing methods |
|---|---|
| `billing.*` | `billing.state`, `billing.charge`, `billing.charge_status`, `billing.step_up`, `billing.auto_reload` |
| `learning.*` | `learning.frames`, `learning.detail`, `learning.edit`, `learning.delete` |
| `projects.*` | `projects.tree`, `projects.discover_repos`, `projects.record_repos`, `projects.project_sessions` |
| `project.*` | `project.facts` |
| `verification.*` | `verification.status` |
| `wake.*` | `wake.start`, `wake.stop`, `wake.status`, `wake.pause`, `wake.resume` |
| `usage.*` | `usage.bars` |
| `llm.*` | `llm.oneshot` |
| `system.*` | `system.battery` |
| `message.*` | `message.react` |
| `file.*` | `file.attach` |
| `pdf.*` | `pdf.attach` |
| `handoff.*` | `handoff.request`, `handoff.state`, `handoff.fail` (CLI `/handoff` exists; RPC doesn't) |
| `image.*` | `image.attach_bytes` (Anakot has `image.attach`/`image.detach` only) |
| `terminal.*` | `terminal.read.respond` (Anakot has `terminal.resize` only) |
| `process.*` | `process.list`, `process.kill` (Anakot has `process.stop` only) |
| `session.*` | `session.redirect`, `session.context_breakdown` |
| `plugins.*` | `plugins.manage` (Anakot has `plugins.list` + Anakot-only `dashboard.plugins.list`) |

### 1.7 Plugins (Hermes-only)

| Plugin | Notes |
|---|---|
| `cron_providers/chronos` | NAS-hosted cron provider |
| `dashboard_auth/drain` | Drain auth provider |
| `dashboard_auth/nous` | Nous auth provider (Anakot has `basic`, `callmemo`, `self_hosted`) |
| Model providers (25 of 33) | `ai-gateway`, `alibaba`, `alibaba-coding-plan`, `arcee`, `azure-foundry`, `bedrock`, `copilot`, `copilot-acp`, `fireworks`, `gmi`, `kilocode`, `kimi-coding`, `minimax`, `nous`, `novita`, `nvidia`, `openai-codex`, `opencode-zen`, `qwen-oauth`, `stepfun`, `upstage`, `vertex`, `xai`, `xiaomi`, `zai` — Anakot has 8 (`anthropic`, `callmemo`, `custom`, `deepseek`, `gemini`, `huggingface`, `ollama-cloud`, `openrouter`); several of the missing are still usable via generic chat_completions/custom endpoints |
| `image_gen/deepinfra` | Image gen provider |
| `video_gen/deepinfra` | Video gen provider |
| `memory/query_rewrite` | Memory query rewrite |
| `web/exa` | — (Anakot has `exa` too — verified `plugins/web/`; NOT missing) |

### 1.8 Skills (notable Hermes-only)

| Skill | Notes |
|---|---|
| `grounded-citations` | research |
| `simplify-code` | productivity |
| `xlsx` | productivity (Anakot has `docx-editing` but no xlsx skill) |
| `obliteratus` | Hermes-only red-teaming |
| `mpp-agent` | Hermes-only |
| `stripe-link-cli` / `stripe-projects` | Hermes-only |
| `tldraw-offline` | Hermes-only |
| `cloudflare-temporary-deploy` | Hermes-only |
| `hermes-s6-container-supervision` | adapted in Anakot as `anakot-s6-container-supervision` |
| `hermes-agent` / `hermes-agent-skill-authoring` | adapted in Anakot as `anakot-agent` / `anakot-agent-skill-authoring` |

### 1.9 Misc subsystems

| Feature | Notes |
|---|---|
| `optional-mcps/` | Hermes ships 13, Anakot ships 2 (`linear`, `n8n`) |
| Native FTS5 CJK extension | `native/fts5_cjk/` |
| Locales | Hermes 18, Anakot 16 (af, de, en, es, fr, ga, hu, it, ja, ko, pt, ru, tr, uk, zh, zh-hant) |
| `vercel_sandbox` terminal environment | Anakot has local/docker/ssh/daytona/modal/managed_modal/singularity |
| `egress` proxy CLI | Docker egress proxy status |
| Suggestions + blueprint catalogs | `cron/suggestions.py`, `suggestion_catalog.py`, `blueprint_catalog.py` (Anakot's cron has jobs/executions but no suggestions/blueprints) |
| `session_export_html/_md`, `session_recap`, `session_recovery`, `session_filters`, `active_sessions` | Hermes session utility modules (Anakot has web-API session export + `sessions` CLI — 🔶 partial) |

---

## 2. 🔶 PARTIAL (present in Anakot but reduced or not wired)

| Feature | Anakot state |
|---|---|
| Learning/Journey graph | Code + starmap UI + `/api/learning/*` exist, but **not wired into `run_agent.py`** — no auto-learning during turns, no `/journey`, no `learning.*` RPC |
| Mixture-of-Agents | `mixture_of_agents` **tool** exists; no `/moa` slash command, no `moa_loop.py`/`moa_trace.py` presets |
| Git review pane | Core ported (view mode, churn data, PR integration via `gh`, heavy-list cap); agent-handoff uses clipboard instead of direct composer submit |
| Pet system | Fully ported (backend + RPC + desktop + generation); missing CLI `/pet` + `/hatch` commands |
| Video generation | `video_analyze`/`video_generate` present; missing `xai_video_edit`, `xai_video_extend`, FLUX3 suite, deepinfra provider |
| Image generation | Present; missing deepinfra provider |
| WhatsApp | Non-cloud pairing adapter only; no Cloud API adapter |
| Secret sources | `bitwarden` only; missing 1Password/command/registry/cache |
| Observability | `langfuse`/`nemo_relay` plugins + insights; missing `agent/monitoring/` (OTLP exporter, cron/gateway health) |
| Provider catalog | 8 preconfigured provider plugins vs 33; many reachable via chat_completions/custom but with manual config |
| Dashboard auth | `basic`, `callmemo`, `self_hosted`; missing `drain`, `nous` |
| Terminal environments | All Hermes' minus `vercel_sandbox` |
| Desktop terminal pane | `terminal-tabs` store + `anakot:terminal:*` IPC exist; missing `read_terminal`/`close_terminal` tools |
| Session utils | Web-API export + sessions CLI; missing `session_export_html/md`, recap, recovery, filters modules |
| Handoff | CLI `/handoff` exists (cli_only); no `handoff.*` RPC for desktop |
| Approval modes | `yolo` + per-command approvals exist; no persistent `/approvals` (manual\|smart\|off) mode |

---

## 3. 🆕 ANAKOT-ONLY (Anakot has it, Hermes doesn't)

| Feature | Where |
|---|---|
| **Web dashboard** (FastAPI, **181 routes**) | `anakot_cli/web_server.py` — sessions CRUD/search/export/bulk-delete, config/env, models, providers/OAuth, messaging, telegram onboarding, cron jobs, MCP servers+catalog, pairing, webhooks, credentials pool, memory, ops (doctor/security-audit/backup/import/hooks/checkpoints), skills hub, profiles+soul, tools/toolsets, admin users/grants, analytics, dashboard themes/plugins, audio (transcribe/ElevenLabs/speak), learning graph, `/v1/chat/completions` proxy |
| **WEB_VERSION** full web app | `WEB_VERSION/` — chat, agents, artifacts, command-center, cron, messaging, notebookllm, plugins, profiles, settings, shell, skills, starmap, i18n, themes — mirrors the desktop UI in the browser, mobile-responsive |
| **NotebookLLM** | Research notebooks: CRUD, source upload/url/text, context, chat + streaming, chat-history, summarize; desktop `/notebook` route + `anakot:notebook:*` IPC + `/api/notebooks/*` |
| **Multi-user admin system** | `auth/me` profiles, admin users/grants, `_require_admin` endpoints, disable/enable users, per-user grants |
| **Discord Rich Presence** | `discord-rpc.cjs` + `discord-rpc-settings.tsx` + `anakot:discord-rpc:*` IPC |
| **`/gquota` command** | Google Gemini Code Assist quota display |
| **`obsidian_graph_scan` tool** | Obsidian vault graph scan (obsidian toolset) |
| **Windows-native support** | `install-anakot.bat/ps1`, `repair-anakot.bat`, `uninstall-anakot.bat`, `anakot_bootstrap.py`, MSYS bash, UTF-8 stdio, Windows footgun checker |
| **Railway deployment** | `railway/`, `railway.json`, `docker-compose.windows.yml` |
| **callmemo provider + account** | `plugins/model-providers/callmemo`, `callmemo_account.py`, `callmemo_subscription.py`, `portal_cli.py` |
| **Desktop mobile shell** | `mobile/` bottom-nav + mobile-shell |
| **`auto-read-aloud` / haptics** | Desktop store + provider |
| **`dashboard.plugins.*` RPC** | `dashboard.plugins.list` |
| **ponytail agent kit** | Bundled `skills/ponytail` (commands, hooks, skills, MCP, pi-extension, benchmarks) |
| **Skin/theme engine + dashboard themes** | `anakot_cli/skin_engine.py` + `~/.anakot/dashboard-themes/` |
| **`mcp_serve.py` + EventBridge approvals** | Exposes the agent as an MCP server (conversations, messages, channels, permissions, events) |
| **Achievements** | `anakot-achievements` plugin (adapted from `hermes-achievements`) |
| **Code review panel** | `store/code-review.ts` + `right-rail/code-review.tsx` — AI bug-analysis panel (NOT the same as Hermes' git review pane) |
| **GitSourceControl workbench** | Full SOURCE CONTROL sidebar (status, diffs, stage/unstage, commit, push, PR) |
| **Webhooks with Svix + GitHub comments delivery** | `gateway/platforms/webhook.py` |
| **`mini_swe_runner.py`** | SWE-bench-style task runner |
| **`gquota`, `doctor`, `security`, `dump`, `backup`, `import`, `hooks`, `secrets`, `migrate` CLI subcommands** | `anakot` top-level subcommand surface |
| **Profiles + soul** | `anakot_cli/profiles.py`, profile describer/distribution, per-profile gateways, `/api/profiles/*` |

---

## 4. Feature Matrix (merged EVERY-feature list by dimension)

### 4.1 CLI commands (Hermes 80+ / Anakot 66+)

| Command | Anakot | Command | Anakot | Command | Anakot |
|---|---|---|---|---|---|
| start | ✅ | new/reset | ✅ | topic | ✅ |
| clear | ✅ | redraw | ✅ | history | ✅ |
| save | ✅ | retry | ✅ | prompt/compose | ❌ |
| undo | ✅ | title | ✅ | handoff | ✅ |
| branch/fork | ✅ | compress/compact | ✅ | rollback | ✅ |
| snapshot/snap | ✅ | stop | ✅ | approve | ✅ |
| deny | ✅ | background/bg/btw | ✅ | agents/tasks | ✅ |
| journey/learning/memory-graph | ❌ | queue/q | ✅ | steer | ✅ |
| goal | ✅ | subgoal | ✅ | status | ✅ |
| egress | ❌ | context/ctx | ❌ | whoami | ✅ |
| profile | ✅ | sethome | ✅ | resume | ✅ |
| sessions | ✅ | config | ✅ | model | ✅ |
| codex-runtime | ✅ | gquota | 🆕 | personality | ✅ |
| statusbar/sb | ✅ | battery | ❌ | timestamps/ts | ❌ |
| diff | ❌ | verbose | ✅ | focus | ❌ |
| footer | ✅ | yolo | ✅ | approvals | ❌ |
| reasoning | ✅ | fast | ✅ | skin | ✅ |
| indicator | ✅ | voice | ✅ | wake | ❌ |
| busy | ✅ | tools | ✅ | toolsets | ✅ |
| skills | ✅ | memory | ❌ | bundles | ✅ |
| pet | ❌ | hatch/generate-pet | ❌ | learn | ❌ |
| init | ❌ | cron | ✅ | suggestions/suggest | ❌ |
| blueprint/bp | ❌ | curator | ✅ | kanban | ✅ |
| reload | ✅ | reload-mcp | ✅ | reload-skills | ✅ |
| browser | ✅ | plugins | ✅ | commands | ✅ |
| help | ✅ | restart | ✅ | usage | ✅ |
| subscription/upgrade | ❌ | topup | ❌ | insights | ✅ |
| platforms/gateway | ✅ | platform | ✅ | copy | ✅ |
| paste | ✅ | image | ✅ | update | ✅ |
| version/v | ✅ | debug | ✅ | quit/exit | ✅ |

### 4.2 Agent core

| Feature | Anakot | Feature | Anakot |
|---|---|---|---|
| Conversation loop (run_conversation) | ✅ | Prompt caching | ✅ |
| Context compression | ✅ | Trajectory compression | ✅ |
| Reasoning scrubbing (think_scrubber) | ✅ | Reasoning timeouts | ❌ |
| Iteration budget | ✅ | Checkpoint manager | ✅ |
| MemoryManager + 8 providers | ✅ | Memory approval gate (`/memory`) | ❌ |
| Learning graph files | ✅ | Learning wired into agent loop | ❌ |
| Mixture-of-Agents | 🔶 | Subagent delegation + spawn_tree | ✅ |
| Background review | ✅ | Relay runtime | ❌ |
| LSP client/manager | ✅ | MCP client (stdio/HTTP/OAuth) | ✅ |
| ACP server | ✅ | mcp_serve (agent as MCP) | 🆕 |
| Prompt builder / system prompt | ✅ | Personalities/souls | ✅ |
| Secret sources | 🔶 (bitwarden only) | Credential pool | ✅ |
| Tool guardrails / TIRITH | ✅ | File safety / path security | ✅ |
| Verification/bounded responses | ❌ | Reactions | ❌ |
| Battery | ❌ | Title generator | ✅ |
| Billing/credits (callmemo) | 🔶 | Nous billing | ❌ |
| Monitoring (OTLP/cron/gateway health) | ❌ | Insights/usage pricing | ✅ |
| i18n | ✅ (16 locales) | FTS5 CJK | ❌ |

### 4.3 Tools

| Tool | Anakot | Tool | Anakot |
|---|---|---|---|
| read_file/write_file/patch/search_files | ✅ | terminal/process/execute_code | ✅ |
| web_search/web_extract | ✅ | vision_analyze/video_analyze | ✅ |
| image_generate | ✅ | video_generate | ✅ |
| xai_video_edit/extend | ❌ | bfl_flux3_* (6 tools) | ❌ |
| browser_navigate/click/type/snapshot/scroll/back/press/console/get_images/vision/cdp/dialog | ✅ | computer_use | ✅ |
| read_terminal/close_terminal | ❌ | react_to_message | ❌ |
| delegate_task | ✅ | mixture_of_agents | ✅ |
| memory/todo/skill_view/skills_list/skill_manage | ✅ | session_search | ✅ |
| cronjob/clarify | ✅ | send_message | ✅ |
| discord/discord_admin | ✅ | x_search | ✅ |
| feishu_doc/drive (5 tools) | ✅ | yuanbao (5 tools) | ✅ |
| ha_* (4 tools) | ✅ | obsidian_graph_scan | 🆕 |
| kanban_create/list/show/comment/complete/link/block/unblock/heartbeat | ✅ | kanban_attach/attach_url/attachments | ❌ |
| project_list/create/switch | ❌ | focus_pane/open_preview | ❌ |
| text_to_speech | ✅ | spotify (plugin) | ✅ |
| google_meet (plugin) | ✅ | environments (10) | 🔶 (no vercel_sandbox) |

### 4.4 Gateway platforms

| Platform | Anakot | Platform | Anakot |
|---|---|---|---|
| telegram | ✅ | discord | ✅ |
| slack | ✅ | whatsapp | ✅ (non-cloud) |
| whatsapp_cloud | ❌ | signal | ✅ |
| email | ✅ | sms | ✅ |
| matrix | ✅ | mattermost | ✅ |
| teams | ✅ | line | ✅ |
| irc | ✅ | feishu | ✅ |
| dingtalk | ✅ | wecom | ✅ |
| weixin | ✅ | google_chat | ✅ |
| homeassistant | ✅ | ntfy | ✅ |
| simplex | ✅ | bluebubbles | ✅ |
| msgraph_webhook | ✅ | qqbot | ✅ |
| yuanbao | ✅ | webhook | ✅ |
| api_server | ✅ | a2a | ❌ |
| buzz | ❌ | raft | ❌ |
| photon | ❌ | gateway/relay | ❌ |

### 4.5 Desktop app

| Feature | Anakot | Feature | Anakot |
|---|---|---|---|
| Chat + composer (rich editor, attachments, queue, undo, branch, voice) | ✅ | Session sidebar | ✅ |
| Command palette | ✅ | Pet palette page | ✅ |
| Marketplace themes page | ❌ | Settings app (17 sections) | 🔶 |
| Shell/statusbar/model menu/context usage | ✅ | Keybind panel | ✅ |
| Right rail (preview, code review, git commit) | ✅ | Right sidebar (files, terminal, review) | 🔶 |
| Workbench (ActivityBar, Explorer, GitSourceControl, SearchPanel, WelcomeView) | ✅ | Projects/worktrees | ❌ |
| Agents monitor | ✅ | Artifacts | ✅ |
| Command center | ✅ | Cron page | ✅ |
| NotebookLLM | 🆕 | Learning journey page | ❌ |
| Starmap | ✅ | Messaging page | ✅ |
| Profiles dialogs | ✅ | Plugins page/slots | ✅ |
| Pet overlay + generation | ✅ | Quick entry | ❌ |
| Wake indicator | ❌ | Webhooks page | ❌ |
| Floating HUD | ❌ | Contrib panes | ❌ |
| Mobile shell | 🆕 | Window effects (translucency/ambient/backdrop) | ❌ |
| Discord RPC | 🆕 | Reactions | ❌ |
| Billing settings | ❌ | Memory settings | ❌ |
| Notifications settings | ❌ | Find in page | ❌ |
| Electron: connection-config, bootstrap, git, LSP, updates, uninstall, OAuth | ✅ | Electron: native-oauth, ssh-bootstrap, worktrees, quick-entry | ❌ |

### 4.6 TUI gateway RPC (90 of 131 present)

| Group | Anakot | Group | Anakot |
|---|---|---|---|
| agents.* | ✅ | approval.* | ✅ |
| billing.* | ❌ | browser.manage | ✅ |
| clarify.* | ✅ | cli.exec | ✅ |
| clipboard.paste | ✅ | command.* | ✅ |
| commands.catalog | ✅ | complete.* | ✅ |
| config.* | ✅ | cron.manage | ✅ |
| delegation.* | ✅ | file.attach | ❌ |
| handoff.* | ❌ | image.* | 🔶 |
| input.detect_drop | ✅ | insights.get | ✅ |
| learning.* | ❌ | llm.oneshot | ❌ |
| message.react | ❌ | model.* | ✅ |
| paste.collapse | ✅ | pdf.attach | ❌ |
| pet.* (15) | ✅ | plugins.list (+dashboard.plugins.list 🆕) | ✅ |
| preview.restart | ✅ | process.* | 🔶 |
| project.facts / projects.* | ❌ | prompt.* | ✅ |
| reload.* | ✅ | rollback.* | ✅ |
| secret.respond | ✅ | session.* (19) | 🔶 (no redirect/context_breakdown) |
| setup.* | ✅ | shell.exec | ✅ |
| skills.* | ✅ | slash.exec | ✅ |
| spawn_tree.* | ✅ | subagent.interrupt | ✅ |
| subscription.* | ❌ | sudo.respond | ✅ |
| system.battery | ❌ | terminal.* | 🔶 |
| tools.* / toolsets.* | ✅ | usage.bars | ❌ |
| verification.status | ❌ | voice.* | ✅ |
| wake.* | ❌ | | |

### 4.7 Plugins

| Plugin | Anakot | Plugin | Anakot |
|---|---|---|---|
| anakot-achievements | 🆕 | browser (browser_use/browserbase/firecrawl) | ✅ |
| context_engine | ✅ | cron_providers/chronos | ❌ |
| dashboard_auth (basic/callmemo/self_hosted) | 🔶 | disk-cleanup | ✅ |
| google_meet | ✅ | image_gen (6) | 🔶 (no deepinfra) |
| kanban | ✅ | memory (8) | ✅ (no query_rewrite) |
| model-providers (8 of 33) | 🔶 | observability (langfuse/nemo_relay) | ✅ |
| platforms (9) | ✅ | security-guidance | ✅ |
| spotify | ✅ | teams_pipeline | ✅ |
| video_gen (2) | 🔶 (no deepinfra) | web (8 search providers) | ✅ |

### 4.8 Skills

| Category | Anakot | Notable Hermes-only |
|---|---|---|
| apple | ✅ (apple-notes, apple-reminders, findmy, imessage, macos-computer-use) | — |
| autonomous-ai-agents | ✅ (anakot-agent, claude-code, codex, opencode) | hermes-agent (adapted) |
| creative | ✅ (16) | — |
| data-science | ✅ (jupyter-live-kernel) | — |
| devops | ✅ (kanban-orchestrator/worker) | — |
| email | ✅ (himalaya) | agentmail → optional ✅ |
| github | ✅ (6) | — |
| media | ✅ (gif-search, heartmula, songsee, youtube-content) | — |
| mlops | ✅ (evaluation, huggingface-hub, inference, models) | — |
| note-taking | ✅ (obsidian) | — |
| productivity | ✅ (airtable, google-workspace, maps, nano-pdf, notion, ocr-and-documents, powerpoint, teams-meeting-pipeline, docx-editing) | simplify-code, xlsx |
| red-teaming | ✅ (godmode) | obliteratus |
| research | ✅ (arxiv, blogwatcher, llm-wiki, polymarket, research-paper-writing) | grounded-citations |
| smart-home | ✅ (openhue) | — |
| social-media | ✅ (xurl) | — |
| software-development | ✅ (9) | — |
| optional-skills (~110) | ✅ | stripe-link-cli, stripe-projects, tldraw-offline, cloudflare-temporary-deploy, mpp-agent |

---

## 5. Recommended porting order (highest value first)

1. **Wire the learning graph into the agent loop** — code exists, `/api/learning/*` works; add turn-time write/read + `/journey` + `learning.*` RPC. Biggest "present but dead" gap.
2. **`/prompt`, `/diff`, `/context`, `/focus`, `/timestamps`, `/battery`** — small CLI-only ports, no backend work.
3. **`/pet` + `/hatch` CLI commands** — backend + RPC already ported; just add CommandDef + handlers.
4. **`/approvals`, `/memory` gates, `/learn`, `/init`** — Hermes patterns: `approval_mode.py`, `learn_prompt.py`, `init_command.py`.
5. **Desktop projects/worktrees** — `projects_db.py` + `projects.*` RPC + `projects.ts` store + sidebar UI.
6. **Provider catalog expansion** — copy Hermes' `ProviderProfile` YAML/plugins for xai, deepinfra, minimax, novita, nvidia, fireworks, vertex, etc.
7. **Platform adapters** — `a2a` and `whatsapp_cloud` are self-contained dirs; port last unless needed.
8. **Verification/bounded responses** — `verification_*.py` + `verification.status` RPC; useful for agentic coding safety.

---

_See `skills/hermes-feature-port` for the worked porting procedure (pet system as example)._

---

## Appendix A — File-level diff evidence (actual Hermes repo vs Anakot checkout)

**Source:** Hermes clone at `C:\Users\Niroth\hermes-repo` (NousResearch/hermes-agent@main, HEAD `3aeff23`) vs `D:\School\PROJECT\anakot-agent` (HEAD `6d3c8e1bc`). Paths normalized for the `hermes→anakot` rename so renamed files count as matched, not missing.

### A.1 Size comparison by directory (code files: ts/tsx/js/css/py/md/yaml/json/sh/bat/ps1)

| Directory | Hermes | Anakot | Anakot % |
|---|---|---|---|
| apps/desktop/src | 1,194 | 460 | **39%** |
| apps/desktop/electron | 153 | 21 | **14%** |
| ui-tui/src | 279 | 204 | 73% |
| ui-tui/packages | 153 | 145 | 95% |
| web/src | 142 | 87 | 61% |
| WEB_VERSION/src | 0 | 455 | n/a (Anakot-only) |
| agent | 180 | 123 | 68% |
| tools | 130 | 100 | 77% |
| gateway | 89 | 63 | 71% |
| gateway/platforms | 29 | 39 | **134%** (Anakot has more) |
| plugins | 326 | 188 | 58% |
| skills | 415 | 506 | **122%** (Anakot has more) |
| optional-skills | 517 | 373 | 72% |
| tests | 2,720 | 1,428 | 52% |
| cron | 11 | 3 | **27%** |
| hermes_cli / anakot_cli | 259 | 129 | 50% |

**Overall:** Hermes 8,450 files → Anakot 5,792 files. After rename normalization: **4,474 matched, 3,976 only in Hermes, 833 only in Anakot.** Excluding tests/contributors/website/docs noise: **2,078 code files only in Hermes, 427 only in Anakot.**

### A.2 The biggest single gap: `apps/desktop` (1,083 Hermes-only files)

Anakot's desktop is ~39% of Hermes' by file count (and only 14% of the Electron main-process modules). Hermes-only desktop surface (beyond what Section 1.5 lists): `src/app/learning/`, `src/app/quick-entry/`, `src/app/wake-indicator/`, `src/app/webhooks/`, `src/app/contrib/`, `src/app/chat/sidebar/projects/`, `src/app/command-palette/marketplace-theme-page.tsx`, `floating-hud.tsx`, `apps/shared/` (9 files — shared desktop/web package), `apps/bootstrap-installer/` (Tauri setup wizard), plus `e2e/` (25 files) and `scripts/` (63 files) tooling.

### A.3 Hermes-only files that confirm the feature gaps (grouped)

- **agent/ (57 files):** `battery.py`, `reactions.py`, `bounded_response.py`, `verification_evidence.py`, `verification_stop.py`, `verify_hooks.py`, `moa_loop.py`, `moa_trace.py`, `learn_prompt.py`, `learning_graph_render.py`, `reasoning_timeouts.py`, `thinking_timeout_guidance.py`, `relay_llm.py`, `relay_runtime.py`, `relay_tools.py`, `oneshot.py`, `outbound_webhooks.py`, `secret_scope.py`, `secret_sources/{base,command,onepassword,registry,_cache}.py`, `proxy_sources/iron_proxy.py`, `monitoring/` (9: OTLP exporter, cron/gateway health, policy, redaction), `billing_*.py`, `subscription_view.py`, `turn_finalizer.py`, `turn_retry_state.py`, `turn_summary.py`, `turn_context.py`, `thread_scoped_output.py`, `coding_context.py`, `delegation_context.py`, `context_breakdown.py`, `session_activity.py`, `subagent_lifecycle.py`, `stream_single_writer.py`, `ssl_guard.py`, `ssl_verify.py`, `trace_upload.py`, `replay_cleanup.py`, `kanban_stop.py`, `interrupt_compat.py`, `backend_identity.py`, `aux_accounting.py`, `vertex_adapter.py`, `nous_rate_guard.py`, `errors.py`, `message_content.py`
- **gateway/ (34 files):** `relay/` (8), `profile_routing.py`, `authz_mixin.py`, `dead_targets.py`, `delivery_ledger.py`, `drain_control.py`, `lifecycle_ledger.py`, `response_filters.py`, `restart_loop_guard.py`, `rich_sent_store.py`, `scale_to_zero.py`, `session_stall.py`, `session_state.py`, `shutdown_flush.py`, `shutdown_watchdog.py`, `systemd_notify.py`, `readiness.py`, `code_skew.py`, `cwd_placeholder.py`, `message_timestamps.py`, `status_phrases.py`, `wake.py`, `turn_lease.py`, `turn_context.py`, `kanban_watchers.py`, `streaming_tts_consumer.py`, `slash_commands.py`, `assets/status_phrases.yaml`, `platforms/{whatsapp_cloud,whatsapp_common,signal_format,webhook_filters,media_cache}.py`
- **tools/ (34 files):** `wake_word.py` + `wakewords/{hey_hermes.onnx,hey_hermes.tflite}`, `react_to_message_tool.py`, `read_terminal_tool.py`, `close_terminal_tool.py`, `focus_pane_tool.py`, `open_preview_tool.py`, `desktop_ui.py`, `project_tools.py`, `flux3_video_tool.py`, `xai_video_tools.py`, `working_diff.py`, `write_approval.py`, `blueprints.py`, `read_extract.py`, `terminal_hints.py`, `hook_output_spill.py`, `skills_sync_client.py`, `tts_streaming.py`, `tts_text_normalize.py`, `audio_container.py`, `image_source.py`, `mcp_dashboard_oauth.py`, `mcp_schema_cache.py`, `mcp_stdio_watchdog.py`, `async_delegation.py`, `daemon_pool.py`, `delegation_live_log.py`, `computer_use/{browser_route,doctor,permissions}.py`, `environments/vercel_sandbox.py`
- **hermes_cli/ (module-level gaps — Anakot's single-file `anakot_cli` covers much of this, but these have no Anakot counterpart):** `approval_mode.py`, `approvals_suggest.py`, `journey.py`, `moa_cmd.py`, `moa_config.py`, `init_command.py`, `projects_db.py`, `projects_cmd.py`, `suggestions_cmd.py`, `blueprint_cmd.py`, `focus_view.py`, `console_engine.py`, `sessions_cmd.py`, `session_export*.py`, `session_recovery.py`, `session_filters.py`, `session_listing.py`, `active_sessions.py`, `mem_trim.py`, `model_cost_guard.py`, `model_search.py`, `model_setup_flows.py`, `provider_catalog.py`, `prompt_stash.py`, `bang_shell.py`, `managed_scope.py`, `mcp_security.py`, `memory_oauth.py`, `setup_hidden_env.py`, `setup_whatsapp_cloud.py`, `gateway_enroll.py`, `dashboard_procs.py`, `credential_lifecycle.py`, `context_switch_guard.py`, `input_sanitize.py`, `diagnostics_upload.py`, `timefmt.py`, `update_lock.py`, `route_identity.py`, `slash_exec.py`, `toolset_validation.py`, `urllib_security.py`, `web_git.py`, `web_models.py`, `npm_engine.py`, `web_deps.py`, `sqlite_runtime.py`, `sqlite_util.py`, `sqlite_safe_read.py`, `nous_account.py`, `nous_billing.py`, `nous_subscription.py`, `nous_auth_keepalive.py`, `cli_billing_mixin.py`, `onepassword_secrets_cli.py`, `vercel_auth.py`, `observability/` (7), `dashboard_auth/` (3)
- **plugins/:** `cron_providers/` (5), `memory/{config_schema,query_rewrite}.py`, `plugin_utils.py`, model-providers (52 files → ~25 providers), platforms (67 files → a2a/buzz/raft/photon/whatsapp_cloud + helpers), image_gen + video_gen deepinfra, dashboard_auth nous/drain
- **skills/:** productivity internals for `docx`, `pdf`, `powerpoint`, `xlsx` (Anakot has equivalents for docx/pdf/pptx; **xlsx missing**), `autonomous-ai-agents` (20), `mlops` (10), `research` (5), `software-development` (5)
- **optional-skills/:** `security/` — `godmode` (Anakot has it under red-teaming), `unbroker` (missing); `payments/` — `mpp-agent`, `stripe-link-cli`, `stripe-projects` (all missing); plus creative (58), mlops (9), mcp (3), research (3), data-science (2), web-development (2), productivity (5)
- **cron/ (11 vs 3):** `suggestions.py`, `suggestion_catalog.py`, `blueprint_catalog.py`, `lifecycle_guard.py`, `scheduler_provider.py`, `executions.py`, `scripts/classify_items.py` — Anakot has `scheduler.py` + `jobs.py` only

### A.4 Anakot-only files (833) — highlights

`WEB_VERSION/` (455 files — full web app), `anakot_cli/web_dist/` (128 — compiled dashboard), `anakot_cli/dashboard_auth/` (14 — more auth providers than Hermes), `plugins/anakot-achievements/` (10), `docker/s6-rc.d/` (4), `anakot_bootstrap.py`, `anakot_cli/{auth,auth_commands,backup,banner,browser_connect,build_info,bundles,callbacks,callmemo_account,callmemo_subscription,portal_cli,profiles,notebooks,web_server,pty_bridge,skin_engine,discord_rpc,...}.py`, `.github/actions/`, `apps/desktop` extras (mobile/, notebookllm/, GitSourceControl), `skills/ponytail/`, `anakot-already-has-routines.md`

### A.5 Test coverage

Hermes ships **2,720 test files → Anakot 1,428 (52%)**. The biggest gaps are `tests/gateway` (310), `tests/hermes_cli` (251), `tests/agent` (203), `tests/tools` (169), `tests/plugins` (65), `tests/run_agent` (62), `tests/tui_gateway` (42), `tests/cron` (22), `tests/docker` (14). Anakot adds its own `tests/anakot_cli` (308). This means the ported core is less guarded against regressions than upstream — relevant when porting new features.

_See `docs/_hermes_only_files.txt` and `docs/_anakot_only_files.txt` for the complete per-file lists._
