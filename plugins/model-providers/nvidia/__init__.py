"""NVIDIA provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

nvidia = ProviderProfile(
    name="nvidia",
    env_vars=("NVIDIA_API_KEY",),
    display_name="NVIDIA",
    description="NVIDIA NIM — hosted and self-hosted inference",
    base_url="https://integrate.api.nvidia.com/v1",
    default_max_tokens=16384,
    fixed_temperature=None,
    default_headers={},
)
register_provider(nvidia)
