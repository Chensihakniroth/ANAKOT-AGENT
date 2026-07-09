/**
 * usePlugins hook — discovers and loads dashboard plugins.
 */

import { useState, useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import { $gateway } from "@/store/gateway";
import type { PluginManifest, RegisteredPlugin } from "./types";
import {
  getPluginComponent,
  onPluginRegistered,
  notifyPluginRegistry,
  setPluginLoadError,
} from "./registry";

/**
 * VS Code / Linear-inspired kanban redesign.
 * Ultra-minimal: monochrome, 1px borders, no shadows, tight spacing, mono metadata.
 */
const KANBAN_CSS = `
/* ── Shell ─────────────────────────────────────────────── */
.plugin-scope .anakot-kanban {
  height: 100% !important;
  gap: 0.25rem !important;
  font: 0.8125rem/1.4 var(--dt-font-sans) !important;
}

/* ── Columns strip ────────────────────────────────────── */
.plugin-scope .anakot-kanban-columns {
  flex: 1 1 auto !important;
  gap: 0 !important;
  align-items: stretch !important;
  overflow-x: auto !important;
  padding: 0 !important;
  min-height: 0 !important;
}

.plugin-scope .anakot-kanban-column {
  flex: 0 0 250px !important;
  border-radius: 0 !important;
  border: none !important;
  border-right: 1px solid var(--ui-stroke-tertiary) !important;
  background: transparent !important;
  max-height: none !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}
.plugin-scope .anakot-kanban-column:last-child {
  border-right: none !important;
}

.plugin-scope .anakot-kanban-column--drop {
  background: color-mix(in srgb, var(--ui-accent-secondary) 6%, transparent) !important;
}

/* ── Column header ────────────────────────────────────── */
.plugin-scope .anakot-kanban-column-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 2 !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.4rem !important;
  padding: 0.35rem 0.6rem !important;
  background: var(--ui-bg-editor) !important;
  border-bottom: 1px solid var(--ui-stroke-tertiary) !important;
  font-size: 0.65rem !important;
  font-weight: 500 !important;
  color: var(--ui-text-tertiary) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
}

.plugin-scope .anakot-kanban-column-count {
  font-variant-numeric: tabular-nums !important;
  color: var(--ui-text-quaternary) !important;
  font-size: 0.6rem !important;
  margin-left: auto !important;
}

.plugin-scope .anakot-kanban-column-add {
  width: 16px !important;
  height: 16px !important;
  border-radius: 2px !important;
  border: none !important;
  background: transparent !important;
  color: var(--ui-text-quaternary) !important;
  font-size: 0.75rem !important;
  opacity: 1 !important;
}
.plugin-scope .anakot-kanban-column-add:hover {
  background: var(--ui-row-hover-background) !important;
  color: var(--ui-text-primary) !important;
}

.plugin-scope .anakot-kanban-column-sub {
  padding: 0.2rem 0.6rem !important;
  font-size: 0.6rem !important;
  color: var(--ui-text-quaternary) !important;
  border-bottom: 1px solid var(--ui-stroke-tertiary) !important;
  margin: 0 !important;
}

/* ── Column body ──────────────────────────────────────── */
.plugin-scope .anakot-kanban-column-body {
  padding: 0.25rem !important;
  gap: 0.25rem !important;
  overflow-y: auto !important;
  flex: 1 !important;
  min-height: 0 !important;
}

.plugin-scope .anakot-kanban-empty {
  padding: 0.75rem 0.5rem !important;
  font-size: 0.65rem !important;
  color: var(--ui-text-quaternary) !important;
  border: 1px dashed var(--ui-stroke-quaternary) !important;
  border-radius: 0 !important;
  text-align: center !important;
}

/* ── Status dots ──────────────────────────────────────── */
.plugin-scope .anakot-kanban-dot {
  width: 0.35rem !important;
  height: 0.35rem !important;
  border-radius: 1px !important;
}
.plugin-scope .anakot-kanban-dot-triage    { background: #b47dd6 !important; }
.plugin-scope .anakot-kanban-dot-todo      { background: var(--ui-text-quaternary) !important; }
.plugin-scope .anakot-kanban-dot-scheduled { background: #b08ad9 !important; }
.plugin-scope .anakot-kanban-dot-ready     { background: #d4b348 !important; }
.plugin-scope .anakot-kanban-dot-running   { background: #3fb97d !important; }
.plugin-scope .anakot-kanban-dot-blocked   { background: #cf2d56 !important; }
.plugin-scope .anakot-kanban-dot-review    { background: #db704b !important; }
.plugin-scope .anakot-kanban-dot-done      { background: #4a8cd1 !important; opacity: 0.5; }
.plugin-scope .anakot-kanban-dot-archived  { background: var(--ui-stroke-quaternary) !important; }

/* ── Cards ────────────────────────────────────────────── */
.plugin-scope .anakot-kanban-card {
  cursor: grab !important;
  border-radius: 0 !important;
  border: 1px solid var(--ui-stroke-tertiary) !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: none !important;
  padding: 0 !important;
}
.plugin-scope .anakot-kanban-card:hover {
  border-color: var(--ui-stroke-secondary) !important;
  background: var(--ui-row-hover-background) !important;
  box-shadow: none !important;
  transform: none !important;
}
.plugin-scope .anakot-kanban-card:active {
  cursor: grabbing !important;
  transform: none !important;
}

.plugin-scope .anakot-kanban-card--selected {
  border-color: var(--ui-accent-secondary) !important;
  background: color-mix(in srgb, var(--ui-accent-secondary) 4%, transparent) !important;
}
.plugin-scope .anakot-kanban-card--failed {
  border-color: var(--ui-red) !important;
}

.plugin-scope .anakot-kanban-card-content {
  padding: 0.4rem 0.5rem !important;
  gap: 0.2rem !important;
}

.plugin-scope .anakot-kanban-card-title {
  font-size: 0.78rem !important;
  font-weight: 400 !important;
  line-height: 1.35 !important;
  color: var(--ui-text-primary) !important;
}

.plugin-scope .anakot-kanban-card-id {
  font: 0.6rem/1 var(--dt-font-mono) !important;
  color: var(--ui-text-quaternary) !important;
  letter-spacing: 0.02em !important;
}

.plugin-scope .anakot-kanban-card-meta {
  font-size: 0.6rem !important;
  color: var(--ui-text-tertiary) !important;
  gap: 0.35rem !important;
}

.plugin-scope .anakot-kanban-card-row {
  gap: 0.25rem !important;
}

/* ── Badges / pills ───────────────────────────────────── */
.plugin-scope .anakot-kanban-priority,
.plugin-scope .anakot-kanban-tag,
.plugin-scope .anakot-kanban-needs-assignee {
  font: 0.55rem/1 var(--dt-font-mono) !important;
  padding: 0.05rem 0.2rem !important;
  border: none !important;
  border-radius: 1px !important;
  letter-spacing: 0.02em !important;
}
.plugin-scope .anakot-kanban-priority {
  background: color-mix(in srgb, var(--ui-accent-secondary) 10%, transparent) !important;
  color: var(--ui-text-secondary) !important;
}
.plugin-scope .anakot-kanban-tag {
  background: color-mix(in srgb, var(--ui-text-tertiary) 8%, transparent) !important;
  color: var(--ui-text-tertiary) !important;
}
.plugin-scope .anakot-kanban-needs-assignee {
  background: color-mix(in srgb, #d4b348 12%, transparent) !important;
  color: #d4b348 !important;
}

.plugin-scope .anakot-kanban-assignee {
  font-weight: 400 !important;
  color: var(--ui-text-secondary) !important;
}
.plugin-scope .anakot-kanban-unassigned {
  font-style: italic !important;
  color: var(--ui-text-quaternary) !important;
}

/* ── Progress pill ────────────────────────────────────── */
.plugin-scope .anakot-kanban-progress {
  font: 0.55rem/1 var(--dt-font-mono) !important;
  padding: 0 0.2rem !important;
  border: none !important;
  border-radius: 1px !important;
  background: color-mix(in srgb, var(--ui-text-tertiary) 10%, transparent) !important;
  color: var(--ui-text-tertiary) !important;
}
.plugin-scope .anakot-kanban-progress--full {
  background: color-mix(in srgb, #3fb97d 15%, transparent) !important;
  color: #3fb97d !important;
}

/* ── Lanes ────────────────────────────────────────────── */
.plugin-scope .anakot-kanban-lane {
  gap: 0.2rem !important;
  padding: 0.15rem 0 !important;
  border-top: 1px dashed var(--ui-stroke-quaternary) !important;
}
.plugin-scope .anakot-kanban-lane-head {
  font-size: 0.55rem !important;
  color: var(--ui-text-quaternary) !important;
  padding: 0 0.1rem !important;
}
.plugin-scope .anakot-kanban-lane-name {
  font-weight: 400 !important;
  font-family: var(--dt-font-mono) !important;
}

/* ── Drawer ───────────────────────────────────────────── */
.plugin-scope .anakot-kanban-drawer-shade {
  position: absolute !important;
  inset: 0 !important;
  z-index: 60 !important;
  background: rgba(0,0,0,0.3) !important;
  backdrop-filter: blur(2px) !important;
  display: flex !important;
  justify-content: flex-end !important;
}
.plugin-scope .anakot-kanban-drawer {
  max-height: 100% !important;
  overflow-y: auto !important;
  width: min(480px, 85%) !important;
  background: var(--ui-bg-editor) !important;
  border-left: 1px solid var(--ui-stroke-tertiary) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  animation: none !important;
}
.plugin-scope .anakot-kanban-drawer-head {
  padding: 0.4rem 0.6rem !important;
  border-bottom: 1px solid var(--ui-stroke-tertiary) !important;
  font: 0.7rem/1 var(--dt-font-mono) !important;
  background: transparent !important;
}
.plugin-scope .anakot-kanban-drawer-body {
  padding: 0.5rem 0.6rem !important;
  gap: 0.5rem !important;
}
.plugin-scope .anakot-kanban-drawer-title {
  font-size: 0.8rem !important;
  font-weight: 500 !important;
}

/* ── Toolbar ─────────────────────────────────────────── */
.plugin-scope .anakot-kanban > div:first-child {
  flex-wrap: wrap !important;
  gap: 0.4rem !important;
  padding: 0.25rem 0.5rem !important;
  border-bottom: 1px solid var(--ui-stroke-tertiary) !important;
  margin: 0 !important;
}

/* ── Docs link (? button) ─────────────────────────────── */
.plugin-scope .anakot-kanban-docs-link {
  display: none !important;
}

/* ── Trash ────────────────────────────────────────────── */
.plugin-scope .anakot-kanban-trash {
  flex: 0 0 40px !important;
  border-radius: 0 !important;
  border: 1px dashed var(--ui-stroke-quaternary) !important;
  background: transparent !important;
}
.plugin-scope .anakot-kanban-trash--drop {
  border-color: var(--ui-red) !important;
  background: color-mix(in srgb, var(--ui-red) 6%, transparent) !important;
}

/* ── Messages ─────────────────────────────────────────── */
.plugin-scope .anakot-kanban-msg-ok,
.plugin-scope .anakot-kanban-msg-err {
  border-radius: 0 !important;
  font-size: 0.7rem !important;
}
`;

function getPluginOverrideCSS(name: string): string {
  if (name === "kanban") return KANBAN_CSS;
  return "";
}

function getPluginBasePath(): string {
  if (typeof window !== 'undefined') {
    const bp = (window as unknown as Record<string, unknown>).__ANAKOT_BASE_PATH__ as string | undefined
    if (bp) return bp.startsWith('/') ? bp : `/${bp}`
  }
  return ''
}

export function usePlugins() {
  const [manifests, setManifests] = useState<PluginManifest[]>([]);
  const [plugins, setPlugins] = useState<RegisteredPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedScripts = useRef<Set<string>>(new Set());
  const gateway = useStore($gateway);

  useEffect(() => {
    if (!gateway) return;
    gateway
      .request("dashboard.plugins.list")
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.plugins || [];
        setManifests(list);
        if (list.length === 0) setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gateway]);

  useEffect(() => {
    if (manifests.length === 0) return;

    const basePath = getPluginBasePath();
    const injectedScripts: HTMLScriptElement[] = [];
    const injectedLinks: HTMLLinkElement[] = [];
    const injectedOverrides: HTMLStyleElement[] = [];

    for (const manifest of manifests) {
      if (manifest.css) {
        const cssUrl = `${basePath}/dashboard-plugins/${manifest.name}/${manifest.css}`;
        if (!document.querySelector(`link[href="${cssUrl}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = cssUrl;
          injectedLinks.push(link);

          let injected = false;
          const injectOverride = () => {
            if (injected) return;
            const overrideCSS = getPluginOverrideCSS(manifest.name);
            if (!overrideCSS) return;
            const existing = document.querySelector(`style[data-anakot-plugin-override="${manifest.name}"]`);
            if (existing) existing.remove();
            const style = document.createElement("style");
            style.setAttribute("data-anakot-plugin-override", manifest.name);
            style.textContent = overrideCSS;
            document.head.appendChild(style);
            injectedOverrides.push(style);
            injected = true;
          };

          injectOverride();
          link.addEventListener("load", () => {
            requestAnimationFrame(() => requestAnimationFrame(injectOverride));
          });
          link.addEventListener("error", () => setTimeout(injectOverride, 100));
          setTimeout(injectOverride, 500);
          setTimeout(injectOverride, 2000);

          document.head.appendChild(link);
        }
      }

      const baseUrl = `${basePath}/dashboard-plugins/${manifest.name}/${manifest.entry}`;
      const scriptSrc = import.meta.env.DEV ? `${baseUrl}?anakot_dv=${Date.now()}` : baseUrl;
      if (!import.meta.env.DEV) {
        if (loadedScripts.current.has(baseUrl)) continue;
        loadedScripts.current.add(baseUrl);
      }

      const script = document.createElement("script");
      script.setAttribute("data-anakot-plugin", manifest.name);
      script.src = scriptSrc;
      script.async = true;
      if (manifest.integrity && typeof manifest.integrity === "string") {
        script.integrity = manifest.integrity;
        script.crossOrigin = "anonymous";
      }
      script.onerror = () => setPluginLoadError(manifest.name, "LOAD_FAILED");
      script.onload = () => {
        notifyPluginRegistry();
        queueMicrotask(() => {
          if (getPluginComponent(manifest.name)) return;
          setPluginLoadError(manifest.name, "NO_REGISTER");
        });
      };
      document.body.appendChild(script);
      injectedScripts.push(script);
    }

    const timeout = setTimeout(() => setLoading(false), 2000);
    return () => {
      clearTimeout(timeout);
      if (import.meta.env.DEV) {
        for (const el of injectedScripts) el.remove();
        for (const el of injectedOverrides) el.remove();
      }
    };
  }, [manifests]);

  useEffect(() => {
    function resolvePlugins() {
      const resolved: RegisteredPlugin[] = [];
      for (const manifest of manifests) {
        const component = getPluginComponent(manifest.name);
        if (component) resolved.push({ manifest, component });
      }
      setPlugins(resolved);
      if (resolved.length === manifests.length && manifests.length > 0) {
        setLoading(false);
      }
    }
    resolvePlugins();
    const unsub = onPluginRegistered(resolvePlugins);
    return unsub;
  }, [manifests]);

  return { plugins, manifests, loading };
}
