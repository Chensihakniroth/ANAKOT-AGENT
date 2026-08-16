"""MiniMax provider profiles (direct, China direct, OAuth).

All three advertise a ``default_aux_model`` so the auxiliary-client resolver
has a non-empty cheap model to fall back to.  The direct and China-direct
endpoints use the current frontier model (M3); the OAuth / Coding Plan tier
stays on the cheaper generally-available M2.7 (see PR #6082).
"""

from providers import register_provider
from providers.base import ProviderProfile

minimax = ProviderProfile(
    name="minimax",
    env_vars=("MINIMAX_API_KEY",),
    display_name="MiniMax",
    description="MiniMax direct API",
    base_url="https://api.minimax.io/v1",
    default_aux_model="MiniMax-M3",
)
register_provider(minimax)

minimax_cn = ProviderProfile(
    name="minimax-cn",
    env_vars=("MINIMAX_CN_API_KEY",),
    display_name="MiniMax (China)",
    description="MiniMax China direct API",
    base_url="https://api.minimax.chat/v1",
    default_aux_model="MiniMax-M3",
)
register_provider(minimax_cn)

minimax_oauth = ProviderProfile(
    name="minimax-oauth",
    auth_type="oauth_external",
    display_name="MiniMax (OAuth)",
    description="MiniMax browser OAuth / Coding Plan",
    base_url="https://api.minimax.io/v1",
    default_aux_model="MiniMax-M2.7",
)
register_provider(minimax_oauth)
