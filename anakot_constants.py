"""Shared constants for Anakot Agent.

Import-safe module with no dependencies — can be imported from anywhere
without risk of circular imports.
"""

import os
import sys
import sysconfig
from contextvars import ContextVar, Token
from pathlib import Path


_profile_fallback_warned: bool = False
_UNSET = object()
_ANAKOT_HOME_OVERRIDE: ContextVar[str | object] = ContextVar(
    "_ANAKOT_HOME_OVERRIDE", default=_UNSET
)


def set_anakot_home_override(path: str | Path | None) -> Token:
    """Set a context-local Anakot home override and return its reset token.

    This is for in-process, per-task scoping.  It deliberately does not mutate
    ``os.environ`` because that is shared by every thread in the process.
    """
    value: str | object = _UNSET if path is None else str(path)
    return _ANAKOT_HOME_OVERRIDE.set(value)


def reset_anakot_home_override(token: Token) -> None:
    """Restore the previous context-local Anakot home override."""
    _ANAKOT_HOME_OVERRIDE.reset(token)


def get_anakot_home_override() -> str | None:
    """Return the active context-local Anakot home override, if any."""
    override = _ANAKOT_HOME_OVERRIDE.get()
    if override is _UNSET or not override:
        return None
    return str(override)


def _get_platform_default_anakot_home() -> Path:
    """Return the platform-native default Anakot home path."""
    if sys.platform == "win32":
        local_appdata = os.environ.get("LOCALAPPDATA", "").strip()
        base = Path(local_appdata) if local_appdata else Path.home() / "AppData" / "Local"
        return base / "anakot"
    return Path.home() / ".anakot"


def get_anakot_home() -> Path:
    """Return the Anakot home directory (default: platform-native path).

    Reads ANAKOT_HOME or ANAKOT_HOME env var, falls back to the platform-native default.
    This is the single source of truth — all other copies should import this.
    """
    override = get_anakot_home_override()
    if override:
        return Path(override)

    val = (os.environ.get("ANAKOT_HOME") or os.environ.get("ANAKOT_HOME") or "").strip()
    if val:
        return Path(val)

    # Guard: if a non-default profile is sticky-active, warn once that
    # the fallback to the default profile is almost certainly wrong.
    global _profile_fallback_warned
    if not _profile_fallback_warned:
        try:
            fallback_home = _get_platform_default_anakot_home()
            active_path = fallback_home / "active_profile"
            active = active_path.read_text().strip() if active_path.exists() else ""
        except (UnicodeDecodeError, OSError):
            active = ""
        if active and active != "default":
            _profile_fallback_warned = True
            msg = (
                f"[ANAKOT_HOME fallback] ANAKOT_HOME is unset but active "
                f"profile is {active!r}. Falling back to {fallback_home}, which "
                f"is the DEFAULT profile — not {active!r}. Any data this "
                f"process writes will land in the wrong profile."
            )
            try:
                sys.stderr.write(msg + "\n")
                sys.stderr.flush()
            except Exception:
                pass

    return _get_platform_default_anakot_home()


def get_default_anakot_root() -> Path:
    """Return the root Anakot directory for profile-level operations."""
    native_home = _get_platform_default_anakot_home()
    env_home = os.environ.get("ANAKOT_HOME") or os.environ.get("ANAKOT_HOME") or ""
    if not env_home:
        return native_home
    env_path = Path(env_home)
    try:
        env_path.resolve().relative_to(native_home.resolve())
        return native_home
    except ValueError:
        pass

    if env_path.parent.name == "profiles":
        return env_path.parent.parent

    return env_path


def _get_packaged_data_dir(name: str) -> Path | None:
    """Return an installed data-files directory if one exists."""
    candidates = []
    for scheme in ("data", "purelib", "platlib"):
        raw = sysconfig.get_path(scheme)
        if raw:
            candidates.append(Path(raw) / name)
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def get_optional_skills_dir(default: Path | None = None) -> Path:
    """Return the optional-skills directory, honoring package-manager wrappers."""
    override = (os.getenv("ANAKOT_OPTIONAL_SKILLS") or os.getenv("ANAKOT_OPTIONAL_SKILLS") or "").strip()
    if override:
        return Path(override)
    packaged = _get_packaged_data_dir("optional-skills")
    if packaged is not None:
        return packaged
    if default is not None:
        return default
    return get_anakot_home() / "optional-skills"


def get_optional_mcps_dir(default: Path | None = None) -> Path:
    """Return the optional-mcps directory, honoring package-manager wrappers."""
    override = (os.getenv("ANAKOT_OPTIONAL_MCPS") or os.getenv("ANAKOT_OPTIONAL_MCPS") or "").strip()
    if override:
        return Path(override)
    packaged = _get_packaged_data_dir("optional-mcps")
    if packaged is not None:
        return packaged
    if default is not None:
        return default
    return get_anakot_home() / "optional-mcps"


def get_bundled_skills_dir(default: Path | None = None) -> Path:
    """Return the bundled skills directory for source and packaged installs."""
    override = (os.getenv("ANAKOT_BUNDLED_SKILLS") or os.getenv("ANAKOT_BUNDLED_SKILLS") or "").strip()
    if override:
        return Path(override)
    packaged = _get_packaged_data_dir("skills")
    if packaged is not None:
        return packaged
    if default is not None:
        return default
    return get_anakot_home() / "skills"


def get_anakot_dir(new_subpath: str, old_name: str) -> Path:
    """Resolve an Anakot subdirectory with backward compatibility."""
    home = get_anakot_home()
    old_path = home / old_name
    if old_path.exists():
        return old_path
    return home / new_subpath


def display_anakot_home() -> str:
    """Return a user-friendly display string for the current ANAKOT_HOME."""
    home = get_anakot_home()
    try:
        return "~/" + str(home.relative_to(Path.home()))
    except ValueError:
        return str(home)


def secure_parent_dir(path: Path) -> None:
    """Chmod ``0o700`` on the parent directory of *path*, but only if safe."""
    parent = path.parent.resolve()
    if parent == Path("/") or len(parent.parts) < 3:
        return
    try:
        os.chmod(parent, 0o700)
    except OSError:
        pass


def get_subprocess_home() -> str | None:
    """Return a per-profile HOME directory for subprocesses, or None."""
    anakot_home = get_anakot_home_override() or os.getenv("ANAKOT_HOME") or os.getenv("ANAKOT_HOME")
    if not anakot_home:
        return None
    profile_home = os.path.join(anakot_home, "home")
    if os.path.isdir(profile_home):
        return profile_home
    return None


VALID_REASONING_EFFORTS = ("minimal", "low", "medium", "high", "xhigh")


def parse_reasoning_effort(effort: str) -> dict | None:
    """Parse a reasoning effort level into a config dict."""
    if not effort or not effort.strip():
        return None
    effort = effort.strip().lower()
    if effort == "none":
        return {"enabled": False}
    if effort in VALID_REASONING_EFFORTS:
        return {"enabled": True, "effort": effort}
    return None


def is_termux() -> bool:
    """Return True when running inside a Termux (Android) environment."""
    prefix = os.getenv("PREFIX", "")
    return bool(os.getenv("TERMUX_VERSION") or "com.termux/files/usr" in prefix)


_wsl_detected: bool | None = None


def is_wsl() -> bool:
    """Return True when running inside WSL (Windows Subsystem for Linux)."""
    global _wsl_detected
    if _wsl_detected is not None:
        return _wsl_detected
    try:
        with open("/proc/version", "r", encoding="utf-8") as f:
            _wsl_detected = "microsoft" in f.read().lower()
    except Exception:
        _wsl_detected = False
    return _wsl_detected


_container_detected: bool | None = None


def is_container() -> bool:
    """Return True when running inside a Docker/Podman container."""
    global _container_detected
    if _container_detected is not None:
        return _container_detected
    if os.path.exists("/.dockerenv"):
        _container_detected = True
        return True
    if os.path.exists("/run/.containerenv"):
        _container_detected = True
        return True
    try:
        with open("/proc/1/cgroup", "r", encoding="utf-8") as f:
            cgroup = f.read()
            if "docker" in cgroup or "podman" in cgroup or "/lxc/" in cgroup:
                _container_detected = True
                return True
    except OSError:
        pass
    _container_detected = False
    return False


def get_config_path() -> Path:
    """Return the path to ``config.yaml`` under ANAKOT_HOME."""
    return get_anakot_home() / "config.yaml"


def get_skills_dir() -> Path:
    """Return the path to the skills directory under ANAKOT_HOME."""
    return get_anakot_home() / "skills"


def get_env_path() -> Path:
    """Return the path to the ``.env`` file under ANAKOT_HOME."""
    return get_anakot_home() / ".env"


def apply_ipv4_preference(force: bool = False) -> None:
    """Monkey-patch ``socket.getaddrinfo`` to prefer IPv4 connections."""
    if not force:
        return

    import socket

    if getattr(socket.getaddrinfo, "_anakot_ipv4_patched", False):
        return

    _original_getaddrinfo = socket.getaddrinfo

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if family == 0:
            try:
                return _original_getaddrinfo(
                    host, port, socket.AF_INET, type, proto, flags
                )
            except socket.gaierror:
                return _original_getaddrinfo(host, port, family, type, proto, flags)
        return _original_getaddrinfo(host, port, family, type, proto, flags)

    _ipv4_getaddrinfo._anakot_ipv4_patched = True
    socket.getaddrinfo = _ipv4_getaddrinfo


# Backward compatibility aliases
_ANAKOT_HOME_OVERRIDE = _ANAKOT_HOME_OVERRIDE
set_anakot_home_override = set_anakot_home_override
reset_anakot_home_override = reset_anakot_home_override
get_anakot_home_override = get_anakot_home_override
_get_platform_default_anakot_home = _get_platform_default_anakot_home
get_anakot_home = get_anakot_home
get_default_anakot_root = get_default_anakot_root
get_anakot_dir = get_anakot_dir
display_anakot_home = display_anakot_home


PARTIAL_STREAM_STUB_ID = "partial-stream-stub"
FINISH_REASON_LENGTH = "length"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODELS_URL = f"{OPENROUTER_BASE_URL}/models"
