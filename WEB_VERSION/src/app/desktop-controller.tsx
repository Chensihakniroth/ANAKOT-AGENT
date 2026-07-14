import { useStore } from '@nanostores/react'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Pane, PaneMain } from '@/components/pane-shell'
import { useSkinCommand } from '@/themes/use-skin-command'

import { useGroupRegistry } from '@/app/shell/use-group-registry'

import { GatewayOfflineDialog } from '@/components/gateway-offline-dialog'
import { WebLandingPage } from '@/components/web-landing-page'
import { BrandMark } from '@/components/brand-mark'
import { useAuth } from '@/hooks/use-auth'
import { api } from '@/lib/web-anakot-desktop'
import { formatRefValue } from '../components/assistant-ui/directive-text'
import { getSessionMessages, listAllProfileSessions, setApiRequestProfile, type SessionInfo } from '../anakot'
import { preserveLocalAssistantErrors, toChatMessages } from '../lib/chat-messages'
import {
  $fileBrowserOpen,
  $panesFlipped,
  $pinnedSessionIds,
  $rightRailCollapsed,
  $sidebarOpen,
  $sessionsLimit,
  bumpSessionsLimit,
  FILE_BROWSER_DEFAULT_WIDTH,
  FILE_BROWSER_MAX_WIDTH,
  FILE_BROWSER_MIN_WIDTH,
  FILE_BROWSER_PANE_ID,
  pinSession,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_SESSIONS_PAGE_SIZE,
  unpinSession
} from '../store/layout'
import { $filePreviewTarget, $previewTarget, closeActiveRightRailTab } from '../store/preview'
import { $codeReviewData } from '../store/code-review'
import { $activeGatewayProfile, $freshSessionRequest, $newChatProfile, normalizeProfileKey, refreshActiveProfile } from '../store/profile'
import {
  $activeSessionId,
  $currentCwd,
  $freshDraftReady,
  $gatewayState,
  $selectedStoredSessionId,
  $sessions,
  $workingSessionIds,
  mergeSessionPage,
  sessionPinId,
  setAwaitingResponse,
  setBusy,
  setCurrentBranch,
  setCurrentCwd,
  setCurrentModel,
  setCurrentProvider,
  setMessages,
  setFreshDraftReady,
  setSessionProfileTotals,
  setSessions,
  setSessionsLoading,
  setSessionsTotal
} from '../store/session'
import { openUpdatesWindow, startUpdatePoller, stopUpdatePoller } from '../store/updates'

import { SearchPanel } from '@/components/workbench/SearchPanel'
import { SessionList } from '@/components/workbench/SessionList'
import { ActivityBar } from '@/components/workbench/ActivityBar'
import { SidebarHost } from '@/components/workbench/SidebarHost'
import { SessionTab } from '@/components/workbench/SessionTab'
import { WelcomeView } from '@/components/workbench/WelcomeView'

import { openRecentFile, setActiveFilePath, closeEditorTab, setActiveEditorTab, $editorTabs, $activeEditorTabId } from '@/store/workbench'
import { ChatView } from './chat'
import { useComposerActions } from './chat/hooks/use-composer-actions'
import {
  ChatPreviewRail,
  PREVIEW_RAIL_MAX_WIDTH,
  PREVIEW_RAIL_MIN_WIDTH,
  PREVIEW_RAIL_PANE_WIDTH
} from './chat/right-rail'
import { CommandPalette } from './command-palette'
import { useGatewayBoot } from './gateway/hooks/use-gateway-boot'
import { useGatewayRequest } from './gateway/hooks/use-gateway-request'
import { useKeybinds } from './hooks/use-keybinds'
import { ModelPickerOverlay } from './model-picker-overlay'
import { ModelVisibilityOverlay } from './model-visibility-overlay'
import { RightSidebarPane } from './right-sidebar'
import { MultiTerminalPanel } from './right-sidebar/terminal/multi-terminal'
import { $terminalTakeover } from './right-sidebar/store'
import { NEW_CHAT_ROUTE, registerPluginPaths, routeSessionId, sessionRoute, SETTINGS_ROUTE } from './routes'
import { useContextSuggestions } from './session/hooks/use-context-suggestions'
import { useCwdActions } from './session/hooks/use-cwd-actions'
import { useAnakotConfig } from './session/hooks/use-anakot-config'
import { useMessageStream } from './session/hooks/use-message-stream'
import { useModelControls } from './session/hooks/use-model-controls'
import { usePreviewRouting } from './session/hooks/use-preview-routing'
import { usePromptActions } from './session/hooks/use-prompt-actions'
import { useRouteResume } from './session/hooks/use-route-resume'
import { useSessionActions } from './session/hooks/use-session-actions'
import { useSessionStateCache } from './session/hooks/use-session-state-cache'
import { AppShell } from './shell/app-shell'
import { useOverlayRouting } from './shell/hooks/use-overlay-routing'
import { useStatusSnapshot } from './shell/hooks/use-status-snapshot'
import { useStatusbarItems } from './shell/hooks/use-statusbar-items'
import { ModelMenuPanel } from './shell/model-menu-panel'
import type { StatusbarItem } from './shell/statusbar-controls'
import { OverlayModal } from './overlays/overlay-modal'

const AgentsView = lazy(async () => ({ default: (await import('./agents')).AgentsView }))
const ArtifactsView = lazy(async () => ({ default: (await import('./artifacts')).ArtifactsView }))
const CommandCenterView = lazy(async () => ({ default: (await import('./command-center')).CommandCenterView }))
const CronView = lazy(async () => ({ default: (await import('./cron')).CronView }))
const MessagingView = lazy(async () => ({ default: (await import('./messaging')).MessagingView }))
const ProfilesView = lazy(async () => ({ default: (await import('./profiles')).ProfilesView }))
const SettingsView = lazy(async () => ({ default: (await import('./settings')).SettingsView }))
const SkillsView = lazy(async () => ({ default: (await import('./skills')).SkillsView }))
const PluginsView = lazy(async () => ({ default: (await import('./plugins/PluginsView')).PluginsView }))
const PluginPageView = lazy(async () => ({ default: (await import('./plugins/PluginPageView')).PluginPageView }))
const StarmapView = lazy(async () => ({ default: (await import('./starmap')).StarmapView }))

// Re-export usePlugins at module scope so we can use it in the controller
// to register plugin paths early.
import { usePlugins } from './plugins/usePlugins'

// Rows a session refresh must preserve even if the aggregator omits them:
// in-flight first turns (message_count 0), pinned rows aged off the page, and
// the actively-viewed chat (its "working" flag clears a beat before the
// aggregator sees the persisted row). Pass `scope` to only keep the active row
// when it belongs to the profile being paged.
function sessionsToKeep(scope?: string): Set<string> {
  const keep = new Set<string>([...$workingSessionIds.get(), ...$pinnedSessionIds.get()])
  const active = $selectedStoredSessionId.get()

  if (active) {
    const session = scope ? $sessions.get().find(s => s.id === active) : null

    if (!scope || !session || normalizeProfileKey(session.profile) === scope) {
      keep.add(active)
    }
  }

  return keep
}

export function DesktopController() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const busyRef = useRef(false)
  const creatingSessionRef = useRef(false)
  const refreshSessionsRequestRef = useRef(0)

  const gatewayState = useStore($gatewayState)
  const activeSessionId = useStore($activeSessionId)
  const currentCwd = useStore($currentCwd)
  const freshDraftReady = useStore($freshDraftReady)
  const filePreviewTarget = useStore($filePreviewTarget)
  const previewTarget = useStore($previewTarget)
  const codeReviewData = useStore($codeReviewData)
  const selectedStoredSessionId = useStore($selectedStoredSessionId)
  const terminalTakeover = useStore($terminalTakeover)
  const panesFlipped = useStore($panesFlipped)

  // Auth gate: when the server requires auth (e.g. Railway deploy),
  // check session and show login page if not authenticated.
  const {
    authRequired,
    isAuthenticated,
    loading: authLoading,
    providers,
    providersLoading,
    user: authUser,
    error: authError,
    login,
    passwordLogin,
    retry,
  } = useAuth()

  // Onboarding: first-time users who just logged in need to pick a name
  // and create a profile before they can use the app.
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(false)

  // After auth succeeds (or is detected via session cookie), check if the
  // user has a profile. If not, show the onboarding dialog.
  useEffect(() => {
    if (!authRequired || !isAuthenticated) return

    let cancelled = false
    setOnboardingLoading(true)

    api<{ profile: string | null; needs_onboarding: boolean }>({
      path: '/api/auth/profile-for-user',
    })
      .then((res) => {
        if (!cancelled) {
          if (res.needs_onboarding) {
            setNeedsOnboarding(true)
          } else {
            setNeedsOnboarding(false)
          }
          if (res.profile) {
            $activeGatewayProfile.set(res.profile)
            $newChatProfile.set(res.profile)
            setApiRequestProfile(res.profile)
          }
        }
      })
      .catch(() => {
        // Not auth-required or server error — skip onboarding
        if (!cancelled) setNeedsOnboarding(false)
      })
      .finally(() => {
        if (!cancelled) setOnboardingLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authRequired, isAuthenticated])

  // Load plugin manifests early and register their routes so navigating
  // to /kanban, /achievements, etc. is recognised by the router.
  const { manifests: pluginManifests, plugins: registeredPlugins } = usePlugins()
  useEffect(() => {
    if (pluginManifests.length > 0) {
      registerPluginPaths(pluginManifests.map(m => m.tab.path))
    }
  }, [pluginManifests])

  const routedSessionId = routeSessionId(location.pathname)
  const routeToken = `${location.pathname}:${location.search}:${location.hash}`
  const routeTokenRef = useRef(routeToken)
  routeTokenRef.current = routeToken
  const getRouteToken = useCallback(() => routeTokenRef.current, [])

  const {
    agentsOpen,
    artifactsOpen,
    chatOpen,
    closeOverlayToPreviousRoute,
    commandCenterInitialSection,
    commandCenterOpen,
    cronOpen,
    currentView,
    messagingOpen,
    openAgents,
    openCommandCenterSection,
    profilesOpen,
    settingsOpen,
    skillsOpen,
    pluginsOpen,
    pluginPageOpen,
    starmapOpen,
    toggleCommandCenter
  } = useOverlayRouting()

  const terminalTakeoverActive = chatOpen && terminalTakeover

  const statusbarItemGroups = useGroupRegistry<StatusbarItem>()
  const setStatusbarItemGroup = statusbarItemGroups.set

  const {
    activeSessionIdRef,
    ensureSessionState,
    runtimeIdByStoredSessionIdRef,
    selectedStoredSessionIdRef,
    sessionStateByRuntimeIdRef,
    syncSessionStateToView,
    updateSessionState
  } = useSessionStateCache({
    activeSessionId,
    busyRef,
    selectedStoredSessionId,
    setAwaitingResponse,
    setBusy,
    setMessages
  })

  const { connectionRef, gatewayRef, requestGateway } = useGatewayRequest()

  useEffect(() => {
    window.anakotDesktop?.setPreviewShortcutActive?.(Boolean(chatOpen && (filePreviewTarget || previewTarget || codeReviewData)))
  }, [chatOpen, codeReviewData, filePreviewTarget, previewTarget])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!$filePreviewTarget.get() && !$previewTarget.get() && !$codeReviewData.get()) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        event.stopPropagation()
        closeActiveRightRailTab()
      }
    }

    const unsubscribe = window.anakotDesktop?.onClosePreviewRequested?.(closeActiveRightRailTab)

    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      unsubscribe?.()
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [])

  const refreshSessions = useCallback(async () => {
    const requestId = refreshSessionsRequestRef.current + 1
    refreshSessionsRequestRef.current = requestId
    setSessionsLoading(true)

    try {
      const limit = $sessionsLimit.get()
      // Require at least one message so abandoned/empty "Untitled" drafts (one
      // was created per TUI/desktop launch before the lazy-create fix) don't
      // clutter the sidebar.
      // Unified cross-profile list (served read-only off each profile's
      // state.db; no per-profile backend is spawned). Single-profile users get
      // the same rows tagged profile="default".
      const result = await listAllProfileSessions(limit, 1)

      if (refreshSessionsRequestRef.current === requestId) {
        setSessions(prev => mergeSessionPage(prev, result.sessions, sessionsToKeep()))
        setSessionsTotal(typeof result.total === 'number' ? result.total : result.sessions.length)
        setSessionProfileTotals(result.profile_totals ?? {})
      }
    } finally {
      if (refreshSessionsRequestRef.current === requestId) {
        setSessionsLoading(false)
      }
    }
  }, [])

  const loadMoreSessions = useCallback(() => {
    bumpSessionsLimit()
    void refreshSessions()
  }, [refreshSessions])

  // ALL-profiles view pages one profile at a time: fetch that profile's next
  // page and merge it in place, leaving every other profile's rows untouched.
  const loadMoreSessionsForProfile = useCallback(async (profile: string) => {
    const key = normalizeProfileKey(profile)
    const inKey = (s: SessionInfo) => normalizeProfileKey(s.profile) === key
    const loaded = $sessions.get().filter(inKey).length
    const result = await listAllProfileSessions(loaded + SIDEBAR_SESSIONS_PAGE_SIZE, 1, 'exclude', 'recent', key)
    const keep = sessionsToKeep(key)

    setSessions(prev => [...prev.filter(s => !inKey(s)), ...mergeSessionPage(prev.filter(inKey), result.sessions, keep)])

    const total = result.profile_totals?.[key] ?? result.total ?? result.sessions.length
    setSessionProfileTotals(prev => ({ ...prev, [key]: Math.max(total, result.sessions.length) }))
  }, [])

  const toggleSelectedPin = useCallback(() => {
    const sessionId = $selectedStoredSessionId.get()

    if (!sessionId) {
      return
    }

    // Pin on the durable lineage-root id so the pin survives auto-compression.
    const session = $sessions.get().find(s => s.id === sessionId || s._lineage_root_id === sessionId)
    const pinId = session ? sessionPinId(session) : sessionId

    if ($pinnedSessionIds.get().includes(pinId)) {
      unpinSession(pinId)
    } else {
      pinSession(pinId)
    }
  }, [])

  const { gatewayLogLines, inferenceStatus, statusSnapshot } = useStatusSnapshot(gatewayState, requestGateway)

  const updateActiveSessionRuntimeInfo = useCallback(
    (info: { branch?: string; cwd?: string }) => {
      const sessionId = activeSessionIdRef.current

      if (!sessionId) {
        return
      }

      updateSessionState(sessionId, state => ({
        ...state,
        branch: info.branch ?? state.branch,
        cwd: info.cwd ?? state.cwd
      }))
    },
    [activeSessionIdRef, updateSessionState]
  )

  const { changeSessionCwd, refreshProjectBranch } = useCwdActions({
    activeSessionId,
    activeSessionIdRef,
    onSessionRuntimeInfo: updateActiveSessionRuntimeInfo,
    requestGateway
  })

  const { refreshAnakotConfig, sttEnabled, voiceMaxRecordingSeconds } = useAnakotConfig({
    activeSessionIdRef,
    refreshProjectBranch
  })

  const { refreshCurrentModel, selectModel, updateModelOptionsCache } = useModelControls({
    activeSessionId,
    queryClient,
    requestGateway
  })

  const openProviderSettings = useCallback(() => {
    navigate(`${SETTINGS_ROUTE}?tab=providers`)
  }, [navigate])

  const modelMenuContent = useMemo(
    () =>
      gatewayState === 'open' ? (
        <ModelMenuPanel
          gateway={gatewayRef.current || undefined}
          onSelectModel={selectModel}
          requestGateway={requestGateway}
        />
      ) : null,
    [gatewayRef, gatewayState, requestGateway, selectModel]
  )

  useContextSuggestions({
    activeSessionId,
    activeSessionIdRef,
    currentCwd,
    gatewayState,
    requestGateway
  })

  const hydrateFromStoredSession = useCallback(
    async (
      attempts = 1,
      storedSessionId = selectedStoredSessionIdRef.current,
      runtimeSessionId = activeSessionIdRef.current
    ) => {
      if (!storedSessionId || !runtimeSessionId) {
        return
      }

      const storedProfile = $sessions.get().find(session => session.id === storedSessionId)?.profile

      for (let index = 0; index < Math.max(1, attempts); index += 1) {
        try {
          const latest = await getSessionMessages(storedSessionId, storedProfile)
          updateSessionState(
            runtimeSessionId,
            state => ({
              ...state,
              messages: preserveLocalAssistantErrors(toChatMessages(latest.messages), state.messages)
            }),
            storedSessionId
          )

          return
        } catch {
          // Best-effort fallback when live stream payloads are empty.
        }

        if (index < attempts - 1) {
          await new Promise(resolve => window.setTimeout(resolve, 250))
        }
      }
    },
    [activeSessionIdRef, selectedStoredSessionIdRef, updateSessionState]
  )

  const { handleGatewayEvent } = useMessageStream({
    activeSessionIdRef,
    hydrateFromStoredSession,
    queryClient,
    refreshAnakotConfig,
    refreshSessions,
    updateSessionState
  })

  const { handleDesktopGatewayEvent, restartPreviewServer } = usePreviewRouting({
    activeSessionIdRef,
    baseHandleGatewayEvent: handleGatewayEvent,
    currentCwd,
    currentView,
    requestGateway,
    routedSessionId,
    selectedStoredSessionId
  })

  const {
    archiveSession,
    branchCurrentSession,
    createBackendSessionForSend,
    openSettings,
    removeSession,
    resumeSession,
    selectSidebarItem,
    startFreshSessionDraft
  } = useSessionActions({
    activeSessionId,
    activeSessionIdRef,
    busyRef,
    creatingSessionRef,
    ensureSessionState,
    getRouteToken,
    navigate,
    requestGateway,
    runtimeIdByStoredSessionIdRef,
    selectedStoredSessionId,
    selectedStoredSessionIdRef,
    sessionStateByRuntimeIdRef,
    syncSessionStateToView,
    updateSessionState
  })

  // Single global listener for every rebindable hotkey (incl. profile switching)
  // plus the on-screen keybind editor's capture mode.
  useKeybinds({
    startFreshSession: startFreshSessionDraft,
    toggleCommandCenter,
    toggleSelectedPin
  })

  // A profile switch/create drops to a fresh new-session draft so the previously
  // open session doesn't bleed across contexts. Skip the initial value.
  const freshSessionRequest = useStore($freshSessionRequest)
  const lastFreshRef = useRef(freshSessionRequest)

  useEffect(() => {
    if (freshSessionRequest === lastFreshRef.current) {
      return
    }

    lastFreshRef.current = freshSessionRequest
    startFreshSessionDraft()
  }, [freshSessionRequest, startFreshSessionDraft])

  // Swapping the live gateway to another profile must re-pull that profile's
  // global model + active-profile pill. Both are nanostores, so the blanket
  // invalidateQueries() the profile store fires on swap doesn't touch them —
  // without this the statusbar keeps showing the previous profile's model
  // (the "forgets the LLM setting" report). gatewayState stays 'open' across a
  // swap (background sockets persist), so the open→open effect won't re-run.
  const activeGatewayProfile = useStore($activeGatewayProfile)
  const lastGatewayProfileRef = useRef(activeGatewayProfile)

  useEffect(() => {
    if (activeGatewayProfile === lastGatewayProfileRef.current) {
      return
    }

    lastGatewayProfileRef.current = activeGatewayProfile
    void refreshCurrentModel()
    void refreshActiveProfile()
  }, [activeGatewayProfile, refreshCurrentModel])

  const composer = useComposerActions({
    activeSessionId,
    currentCwd,
    requestGateway
  })

  const branchInNewChat = useCallback(
    async (messageId?: string) => {
      const branched = await branchCurrentSession(messageId)

      if (branched) {
        await refreshSessions().catch(() => undefined)
      }

      return branched
    },
    [branchCurrentSession, refreshSessions]
  )

  const startSessionInWorkspace = useCallback(
    (path: null | string) => {
      startFreshSessionDraft()

      const target = path?.trim()

      if (!target) {
        return
      }

      // The next message creates the backend session in $currentCwd, so seed
      // it (and the branch) from the workspace the user clicked the + on.
      setCurrentCwd(target)
      void requestGateway<{ branch?: string; cwd?: string }>('config.get', { key: 'project', cwd: target })
        .then(info => {
          setCurrentCwd(info.cwd || target)
          setCurrentBranch(info.branch || '')
        })
        .catch(() => undefined)
    },
    [requestGateway, startFreshSessionDraft]
  )

  const handleSkinCommand = useSkinCommand()

  const {
    cancelRun,
    editMessage,
    handleThreadMessagesChange,
    reloadFromMessage,
    steerPrompt,
    submitText,
    transcribeVoiceAudio
  } = usePromptActions({
      activeSessionId,
      activeSessionIdRef,
      branchCurrentSession: branchInNewChat,
      busyRef,
      createBackendSessionForSend,
      handleSkinCommand,
      refreshSessions,
      requestGateway,
      selectedStoredSessionIdRef,
      startFreshSessionDraft,
      sttEnabled,
      updateSessionState
    })

  useGatewayBoot({
    handleGatewayEvent: handleDesktopGatewayEvent,
    onConnectionReady: c => {
      connectionRef.current = c
    },
    onGatewayReady: g => {
      gatewayRef.current = g
    },
    refreshAnakotConfig,
    refreshSessions
  })

  useEffect(() => {
    if (gatewayState === 'open') {
      void refreshCurrentModel()
      void refreshActiveProfile()
      void refreshSessions().catch(() => undefined)
    }
  }, [gatewayState, refreshCurrentModel, refreshSessions])

  useRouteResume({
    activeSessionId,
    activeSessionIdRef,
    creatingSessionRef,
    currentView,
    freshDraftReady,
    gatewayState,
    locationPathname: location.pathname,
    resumeSession,
    routedSessionId,
    runtimeIdByStoredSessionIdRef,
    selectedStoredSessionId,
    selectedStoredSessionIdRef,
    startFreshSessionDraft
  })

  const { leftStatusbarItems, statusbarItems } = useStatusbarItems({
    agentsOpen,
    commandCenterOpen,
    extraLeftItems: statusbarItemGroups.flat.left,
    extraRightItems: statusbarItemGroups.flat.right,
    gatewayLogLines,
    gatewayState,
    inferenceStatus,
    modelMenuContent,
    openAgents,
    freshDraftReady,
    openCommandCenterSection,
    requestGateway,
    statusSnapshot,
    toggleCommandCenter
  })

  // The ChatSidebar (session history) is now rendered inside the Chat panel.
  // The Explorer panel has its own file tree.
  // We no longer pass `sidebar` into SidebarHost.
  // Chat panel: compact session list + active chat conversation
  const chatPanel = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Compact session list */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <SessionList
          onSelectSession={(sessionId) => { navigate(sessionRoute(sessionId)) }}
          onNewSession={() => startFreshSessionDraft()}
        />
      </div>
    </div>
  )

  const overlays = (
    <>
      <ModelPickerOverlay gateway={gatewayRef.current || undefined} onSelect={selectModel} />
      <ModelVisibilityOverlay gateway={gatewayRef.current || undefined} onOpenProviders={openProviderSettings} />
      <CommandPalette />
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsView
            gateway={gatewayRef.current}
            onClose={closeOverlayToPreviousRoute}
            onConfigSaved={() => {
              void refreshAnakotConfig()
              void refreshCurrentModel()
              void queryClient.invalidateQueries({ queryKey: ['model-options'] })
            }}
            onMainModelChanged={(provider, model) => {
              setCurrentProvider(provider)
              setCurrentModel(model)
              updateModelOptionsCache(provider, model, true)
              void refreshCurrentModel()
              void queryClient.invalidateQueries({ queryKey: ['model-options'] })
            }}
            user={authUser}
          />
        </Suspense>
      )}

      {commandCenterOpen && (
        <Suspense fallback={null}>
          <CommandCenterView
            initialSection={commandCenterInitialSection}
            onClose={closeOverlayToPreviousRoute}
            onDeleteSession={removeSession}
            onNavigateRoute={path => navigate(path)}
            onOpenSession={sessionId => navigate(sessionRoute(sessionId))}
          />
        </Suspense>
      )}

      {agentsOpen && (
        <Suspense fallback={null}>
          <AgentsView onClose={closeOverlayToPreviousRoute} />
        </Suspense>
      )}

      {cronOpen && (
        <Suspense fallback={null}>
          <CronView onClose={closeOverlayToPreviousRoute} />
        </Suspense>
      )}

      {profilesOpen && (
        <Suspense fallback={null}>
          <ProfilesView onClose={closeOverlayToPreviousRoute} />
        </Suspense>
      )}

      {skillsOpen && (
        <Suspense fallback={null}>
          <OverlayModal onClose={closeOverlayToPreviousRoute} title="Skills & Tools">
            <SkillsView setStatusbarItemGroup={setStatusbarItemGroup} />
          </OverlayModal>
        </Suspense>
      )}

      {messagingOpen && (
        <Suspense fallback={null}>
          <OverlayModal onClose={closeOverlayToPreviousRoute} title="Messaging">
            <MessagingView setStatusbarItemGroup={setStatusbarItemGroup} />
          </OverlayModal>
        </Suspense>
      )}

      {artifactsOpen && (
        <Suspense fallback={null}>
          <OverlayModal onClose={closeOverlayToPreviousRoute} title="Artifacts">
            <ArtifactsView setStatusbarItemGroup={setStatusbarItemGroup} />
          </OverlayModal>
        </Suspense>
      )}

      {pluginsOpen && (
        <Suspense fallback={null}>
          <OverlayModal onClose={closeOverlayToPreviousRoute} title="Plugins">
            <PluginsView onClose={closeOverlayToPreviousRoute} />
          </OverlayModal>
        </Suspense>
      )}

      {pluginPageOpen && (
        <Suspense fallback={null}>
          <OverlayModal onClose={closeOverlayToPreviousRoute}>
            <PluginPageView onClose={closeOverlayToPreviousRoute} />
          </OverlayModal>
        </Suspense>
      )}

      {starmapOpen && (
        <Suspense fallback={null}>
          <OverlayModal onClose={closeOverlayToPreviousRoute}>
            <StarmapView onClose={closeOverlayToPreviousRoute} />
          </OverlayModal>
        </Suspense>
      )}

    </>
  )

  const chatView = (
    <ChatView
      gateway={gatewayRef.current}
      maxVoiceRecordingSeconds={voiceMaxRecordingSeconds}
      onAddContextRef={composer.addContextRefAttachment}
      onAddUrl={(url: string) => composer.addContextRefAttachment(`@url:${formatRefValue(url)}`, url)}
      onAttachDroppedItems={composer.attachDroppedItems}
      onAttachImageBlob={composer.attachImageBlob}
      onBranchInNewChat={branchInNewChat}
      onCancel={cancelRun}
      onDeleteSelectedSession={() => {
        if (selectedStoredSessionId) {
          void removeSession(selectedStoredSessionId)
        }
      }}
      onEdit={editMessage}
      onPasteClipboardImage={() => void composer.pasteClipboardImage()}
      onPickFiles={() => void composer.pickContextPaths('file')}
      onPickFolders={() => void composer.pickContextPaths('folder')}
      onPickImages={() => void composer.pickImages()}
      onReload={reloadFromMessage}
      onRemoveAttachment={(id: string) => void composer.removeAttachment(id)}
      onSteer={steerPrompt}
      onSubmit={submitText}
      onThreadMessagesChange={handleThreadMessagesChange}
      onToggleSelectedPin={toggleSelectedPin}
      onTranscribeAudio={transcribeVoiceAudio}
    />
  )

  const takeoverTerminalView = (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background) pt-(--titlebar-height)">
      <MultiTerminalPanel cwd={currentCwd} onAddSelectionToChat={composer.addTerminalSelectionAttachment} />
    </div>
  )

  // Flipped layout mirrors the default: sessions sidebar → right, file
  // browser + preview rail → left. Same panes, swapped sides.
  const sidebarSide = panesFlipped ? 'right' : 'left'
  const railSide = panesFlipped ? 'left' : 'right'

  const rightRailCollapsed = useStore($rightRailCollapsed)

  const previewPane = (
    <Pane
      disabled={rightRailCollapsed || !chatOpen || (!previewTarget && !filePreviewTarget && !codeReviewData)}
      id="preview"
      key="preview"
      maxWidth={PREVIEW_RAIL_MAX_WIDTH}
      minWidth={PREVIEW_RAIL_MIN_WIDTH}
      resizable
      side={railSide}
      width={PREVIEW_RAIL_PANE_WIDTH}
    >
      {chatOpen ? (
        <ChatPreviewRail onRestartServer={restartPreviewServer} />
      ) : null}
    </Pane>
  )

  const fileBrowserPane = (
    <Pane
      defaultOpen={false}
      disabled={rightRailCollapsed || !chatOpen}
      id="file-browser"
      key="file-browser"
      maxWidth={FILE_BROWSER_MAX_WIDTH}
      minWidth={FILE_BROWSER_MIN_WIDTH}
      resizable
      side={railSide}
      width={FILE_BROWSER_DEFAULT_WIDTH}
    >
      <RightSidebarPane
        onActivateFile={composer.attachContextFilePath}
        onActivateFolder={composer.attachContextFolderPath}
        onChangeCwd={changeSessionCwd}
      />
    </Pane>
  )

  // When auth is required + session exists + needs onboarding:
  // silently auto-onboard with a default profile instead of showing the dialog.
  if (authRequired && isAuthenticated && needsOnboarding) {
    const defaultName = authUser?.email?.split('@')[0] || 'User'
    api<{ ok: boolean; profile: string }>({
      path: '/api/auth/onboard',
      method: 'POST',
      body: { display_name: defaultName },
    })
      .then(r => {
        if (r.ok) window.location.reload()
      })
      .catch(() => {
        // If auto-onboard fails, fall through to the main app anyway
        setNeedsOnboarding(false)
      })
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Setting up your profile…</div>
  }

  return (
    <>
      <WebLandingPage
        authRequired={authRequired}
        isAuthenticated={isAuthenticated}
        authLoading={authLoading}
        providers={providers}
        providersLoading={providersLoading}
        authError={authError}
        onLogin={login}
        onPasswordLogin={passwordLogin}
        onRetry={retry}
      />
      <AppShell
        activityBar={<ActivityBar />}
        leftStatusbarItems={leftStatusbarItems}
        onOpenSettings={openSettings}
        overlays={overlays}
        statusbarItems={statusbarItems}
      >
      {/* Sidebar — Explorer / Search / Chat panels */}
      <Pane
        disabled={terminalTakeoverActive}
        id="chat-sidebar"
        maxWidth={SIDEBAR_MAX_WIDTH}
        minWidth={SIDEBAR_DEFAULT_WIDTH}
        resizable
        side={sidebarSide}
        width={`${SIDEBAR_DEFAULT_WIDTH}px`}
      >
        <SidebarHost
          search={<SearchPanel />}
          chat={chatPanel}
        />
      </Pane>

      {/* Main area — Editor tabs + Chat view + Bottom Panel */}
      <PaneMain>
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            {!currentCwd.trim() && !activeSessionId && !freshDraftReady && !previewTarget ? (
              <WelcomeView
                onNewSession={() => startFreshSessionDraft(true)}
                onOpenFolder={() => {
                  void (async () => {
                    const selected = await window.anakotDesktop?.selectPaths({
                      defaultPath: $currentCwd.get().trim() || undefined,
                      directories: true,
                      multiple: false,
                      title: 'Select a folder'
                    })
                    if (selected?.[0]) {
                      setCurrentCwd(selected[0])
                      setFreshDraftReady(true)
                    }
                  })()
                }}
              />
            ) : (
              chatView
            )}
          </div>
        </div>
      </PaneMain>

      {/* Preview pane (right side) */}
      {previewPane}
    </AppShell>
      <GatewayOfflineDialog />
    </>
  )
}

function LegacySessionRedirect() {
  const { sessionId } = useParams()

  return <Navigate replace to={sessionId ? sessionRoute(sessionId) : NEW_CHAT_ROUTE} />
}
