"""Diagnostic: trace exactly what build_models_payload does, step by step."""
import sys, os, traceback

def test():
    print("=== Step 1: import inventory ===")
    try:
        from anakot_cli.inventory import build_models_payload, load_picker_context
        print("  OK")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 2: load_picker_context ===")
    try:
        ctx = load_picker_context()
        print(f"  provider={ctx.current_provider!r}, model={ctx.current_model!r}")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 3: list_authenticated_providers ===")
    try:
        from anakot_cli.model_switch import list_authenticated_providers
        rows = list_authenticated_providers(
            current_provider=ctx.current_provider,
            current_base_url=ctx.current_base_url,
            current_model=ctx.current_model,
            user_providers=ctx.user_providers,
            custom_providers=ctx.custom_providers,
            max_models=200,
        )
        print(f"  Got {len(rows)} provider rows")
        for r in rows:
            print(f"    - {r.get('slug')} ({r.get('name')}): {len(r.get('models', []))} models")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 4: _append_unconfigured_rows ===")
    try:
        from anakot_cli.inventory import _append_unconfigured_rows
        extras = _append_unconfigured_rows(rows, ctx)
        print(f"  Got {len(extras)} unconfigured rows")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 5: _apply_picker_hints ===")
    try:
        from anakot_cli.inventory import _apply_picker_hints
        all_rows = list(rows) + extras
        _apply_picker_hints(all_rows)
        print(f"  OK, {len(all_rows)} total rows")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 6: _reorder_canonical ===")
    try:
        from anakot_cli.inventory import _reorder_canonical
        all_rows = _reorder_canonical(all_rows)
        print(f"  OK")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 7: _apply_pricing ===")
    try:
        from anakot_cli.inventory import _apply_pricing
        _apply_pricing(all_rows)
        print(f"  OK")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 8: _apply_capabilities ===")
    try:
        from anakot_cli.inventory import _apply_capabilities
        _apply_capabilities(all_rows)
        print(f"  OK")
    except Exception:
        traceback.print_exc()
        return

    print("=== Step 9: build final payload ===")
    try:
        payload = build_models_payload(
            ctx,
            max_models=200,
            include_unconfigured=True,
            picker_hints=True,
            canonical_order=True,
            pricing=True,
            capabilities=True,
        )
        print(f"  OK! Keys: {list(payload.keys())}")
        print(f"  providers: {len(payload.get('providers', []))}")
        print(f"  model: {payload.get('model')!r}")
        print(f"  provider: {payload.get('provider')!r}")
    except Exception:
        traceback.print_exc()

    print("\n=== ALL STEPS PASSED ===")

if __name__ == "__main__":
    test()
