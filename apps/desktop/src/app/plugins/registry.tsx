/**
 * Dashboard Plugin SDK + Registry
 *
 * Exposes React, UI components, hooks, and utilities on the window so
 * that plugin bundles can use them without bundling their own copies.
 *
 * Plugins call window.__ANAKOT_PLUGINS__.register(name, Component)
 * to register their tab component.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
  createContext,
} from "react";
import { cn } from "@/lib/utils";
// `timeAgo` and `isoTimeAgo` are removed or stubbed for now if they don't exist in utils.
const timeAgo = (ts: number) => new Date(ts).toISOString();
const isoTimeAgo = (s: string) => s;

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { registerSlot, PluginSlot } from "./slots";

// Stub missing components
const SelectOption = (props: any) => <option {...props} />;
const Card = (props: any) => <div className="rounded-lg border bg-card text-card-foreground shadow-sm" {...props} />;
const CardHeader = (props: any) => <div className="flex flex-col space-y-1.5 p-6" {...props} />;
const CardTitle = (props: any) => <h3 className="font-semibold leading-none tracking-tight" {...props} />;
const CardContent = (props: any) => <div className="p-6 pt-0" {...props} />;
const Label = (props: any) => <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" {...props} />;

// Stub api for desktop plugins since we don't have the web api client
const api: any = async (request: any) => window.anakotDesktop.api(request);

const authedFetch = async (url: string, init?: RequestInit) => {
  const conn = await window.anakotDesktop.getConnection('default');
  if (!conn) throw new Error("No backend connection");
  
  const headers = new Headers(init?.headers || {});
  if (conn.authMode === 'token' && conn.token) {
    headers.set('X-Anakot-Session-Token', conn.token);
  }
  
  const targetUrl = new URL(url, conn.baseUrl).toString();
  
  return fetch(targetUrl, {
    ...init,
    headers
  });
};

const fetchJSON = async <T,>(url: string, init?: RequestInit) => {
  const parsedUrl = new URL(url, "http://localhost");
  const path = parsedUrl.pathname + parsedUrl.search;
  
  let body: any;
  if (init?.body) {
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    } else {
      body = init.body;
    }
  }

  try {
    return (await window.anakotDesktop.api({
      method: init?.method || "GET",
      path: path,
      body: body,
    })) as T;
  } catch (err: any) {
    console.error("fetchJSON error:", err);
    throw err;
  }
};

const buildWsAuthParam = async (): Promise<[string, string]> => {
  const conn = await window.anakotDesktop.getConnection('default');
  return ['token', conn?.token || ''];
};

const buildWsUrl = async (path: string) => {
  const conn = await window.anakotDesktop.getConnection('default');
  if (!conn) throw new Error("No backend connection");
  
  const wsBaseUrl = conn.baseUrl.replace(/^http/, 'ws');
  const url = new URL(path, wsBaseUrl);
  if (conn.authMode === 'token' && conn.token) {
    url.searchParams.set('token', conn.token);
  }
  return url.toString();
};

// ---------------------------------------------------------------------------
// Plugin registry — plugins call register() to add their component.
// ---------------------------------------------------------------------------

type RegistryListener = () => void;

const _registered: Map<string, React.ComponentType> = new Map();
const _loadErrors: Map<string, string> = new Map();
const _listeners: Set<RegistryListener> = new Set();

function _notify() {
  for (const fn of _listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

/** Re-run registry subscribers (e.g. after a plugin script onload, or dev HMR re-inject). */
export function notifyPluginRegistry() {
  _notify();
}

/** Register a plugin component. Called by plugin JS bundles. */
function registerPlugin(name: string, component: React.ComponentType) {
  _loadErrors.delete(name);
  _registered.set(name, component);
  _notify();
}

/** Get a registered component by plugin name. */
export function getPluginComponent(name: string): React.ComponentType | undefined {
  return _registered.get(name);
}

export function getPluginLoadError(name: string): string | undefined {
  return _loadErrors.get(name);
}

export function setPluginLoadError(name: string, message: string) {
  _loadErrors.set(name, message);
  _notify();
}

/** Subscribe to registry changes (returns unsubscribe fn). */
export function onPluginRegistered(fn: RegistryListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Get current count of registered plugins. */
export function getRegisteredCount(): number {
  return _registered.size;
}

// ---------------------------------------------------------------------------
// Expose SDK + registry on window
// ---------------------------------------------------------------------------

/**
 * Version of the plugin SDK contract (see ``plugins/sdk.d.ts``). Bump the
 * major on any backwards-incompatible change to the exposed surface;
 * additive changes (new optional fields / helpers) don't require a bump.
 * Exposed at runtime as ``window.__ANAKOT_PLUGIN_SDK__.sdkVersion`` so a
 * plugin (or a future host-side compatibility gate) can read it.
 */
export const SDK_CONTRACT_VERSION = "1.1.0";

// Window globals for the plugin SDK are declared in ``plugins/sdk.d.ts`` —
// the single source of truth for the public contract. Don't redeclare them
// here (duplicate ambient declarations with differing modifiers conflict).

export function exposePluginSDK() {
  window.__ANAKOT_PLUGINS__ = {
    register: registerPlugin,
    registerSlot,
  };

  window.__ANAKOT_PLUGIN_SDK__ = {
    // Contract version of the plugin SDK surface (see plugins/sdk.d.ts).
    // Bump on backwards-incompatible changes; additive changes don't need it.
    sdkVersion: SDK_CONTRACT_VERSION,
    // React core — plugins use these instead of importing react
    React,
    hooks: {
      useState,
      useEffect,
      useCallback,
      useMemo,
      useRef,
      useContext,
      createContext,
    },

    // Anakot API client
    api,
    // Raw fetchJSON for plugin-specific JSON endpoints
    fetchJSON,
    // Authenticated fetch for non-JSON endpoints (uploads / blob downloads).
    // Handles loopback-token vs gated-cookie auth so plugins never read
    // window.__ANAKOT_SESSION_TOKEN__ directly.
    authedFetch,
    // Build a ws(s):// URL with the correct auth param for the active mode
    // (single-use ticket in gated mode, token in loopback). Use this for any
    // plugin WebSocket instead of hand-assembling the URL.
    buildWsUrl,
    // Lower-level: resolve just the [authParamName, authParamValue] pair, for
    // plugins that need to build the WS URL themselves.
    buildWsAuthParam,

    // UI components — callmemo DS where available, shadcn/ui primitives elsewhere.
    components: {
      Card,
      CardHeader,
      CardTitle,
      CardContent,
      Badge,
      Button,
      Checkbox,
      Input,
      Label,
      Select,
      SelectOption,
      Separator,
      Tabs,
      TabsList,
      TabsTrigger,
      PluginSlot,
    },

    // Utilities
    utils: { cn, timeAgo, isoTimeAgo },

    // Hooks
    useI18n,
  };
}
