import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { persistString, storedString } from '@/lib/storage'
import {
  $petAtRest,
  $petInfo,
  $petRoam,
  $petRoamDir,
  clearPetUnread,
  type PetInfo,
  petProfile,
  setPetInfo
} from '@/store/pet'
import { resetPetGallery, setPetScale } from '@/store/pet-gallery'
import { $petOverlayActive, initPetOverlayBridge, popOutPet, restorePetOverlay } from '@/store/pet-overlay'
import { $gatewayState } from '@/store/session'

import { PetSprite, roamWalkRow } from './pet-sprite'
import { usePetRoam } from './use-pet-roam'
import { type PetZoomAnchor, usePetZoomGesture } from './use-pet-zoom-gesture'

// v2: positions are now top/left anchored (v1 stored bottom-anchored values,
// which dragged inverted). Bumping the key discards stale v1 coordinates.
const POSITION_KEY = 'anakot.desktop.pet-position.v2'

// Stand-in pet size for the pre-load clamp (real size flows in with `info`).
const NOMINAL_PET_PX = 96

interface Point {
  x: number
  y: number
}

interface PetInfoMeta {
  enabled: boolean
  slug?: string
  displayName?: string
  scale?: number
  spritesheetRevision?: string
}

function samePetRevision(info: PetInfo, meta: PetInfoMeta): boolean {
  return (
    info.enabled &&
    Boolean(info.spritesheetBase64) &&
    info.slug === meta.slug &&
    info.displayName === meta.displayName &&
    info.scale === meta.scale &&
    info.spritesheetRevision === meta.spritesheetRevision
  )
}

// Keep a w×h box fully inside the viewport. Pre-pet-load callers pass a nominal
// size; the live size flows in once `info` arrives.
function clampPoint(x: number, y: number, w: number, h: number): Point {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, (window.innerWidth || 800) - w)),
    y: Math.min(Math.max(0, y), Math.max(0, (window.innerHeight || 600) - h))
  }
}

// The sprite art faces left by default, so mirror it when the pet's center sits
// on the left half of the window — it always faces inward, toward the content.
function facing(leftX: number, petW: number): string {
  return leftX + petW / 2 < (window.innerWidth || 800) / 2 ? 'scaleX(-1)' : 'none'
}

function loadPosition(): Point {
  try {
    const raw = storedString(POSITION_KEY)

    if (raw) {
      const parsed = JSON.parse(raw) as Point

      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return clampPoint(parsed.x, parsed.y, NOMINAL_PET_PX, NOMINAL_PET_PX)
      }
    }
  } catch {
    // fall through to default
  }

  // Default: lower-left corner (top/left anchored).
  return clampPoint(24, (window.innerHeight || 600) - 220, NOMINAL_PET_PX, NOMINAL_PET_PX)
}

/**
 * In-window floating pet mascot. Always-on-top within the app, draggable,
 * and reactive to agent activity via `$petState`. Fetches the active pet via
 * the shared `pet.info` RPC; renders nothing until a pet is installed +
 * enabled.
 */
const PET_POLL_MS = 3000
const PET_ACTIVE_REFRESH_MS = 15000

export function FloatingPet() {
  const { requestGateway } = useGatewayRequest()
  const gatewayState = useStore($gatewayState)
  const info = useStore($petInfo)
  const overlayActive = useStore($petOverlayActive)
  const roamEnabled = useStore($petRoam)
  const atRest = useStore($petAtRest)
  const roamDir = useStore($petRoamDir)

  const [position, setPosition] = useState<Point>(loadPosition)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // The facing mirror lives on the sprite wrapper, not the container, so the
  // speech bubble (a container child) never renders flipped/backwards.
  const spriteWrapRef = useRef<HTMLDivElement | null>(null)
  const petW = (info.frameW ?? 192) * (info.scale ?? 0.33)
  const petH = (info.frameH ?? 208) * (info.scale ?? 0.33)
  // Soft contact shadow, sized off the pet so every scale/species grounds the
  // same way.
  const shadowW = Math.round(petW * 0.55)
  const shadowH = Math.max(3, Math.round(shadowW * 0.28))
  const shadowAlpha = 0.55
  // Live drag offset (pointer → element top-left). Drag updates the DOM
  // directly to avoid a React re-render (and canvas reflow) per pointermove —
  // state is only committed on release.
  const dragRef = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null)

  // Keep the *whole* pet on-screen at its current size, so growing it near an
  // edge can't leave the window cropping it. Shared by drag + the reclamp effect.
  const clamp = useCallback(({ x, y }: Point): Point => clampPoint(x, y, petW, petH), [petW, petH])

  // Fetch pet.info on connect. Poll quickly while inactive so an in-app
  // `/pet <slug>` appears, then slowly while active so regenerated spritesheets
  // and row-count metadata replace the cached base64 payload.
  const active = info.enabled && Boolean(info.spritesheetBase64)
  useEffect(() => {
    if (gatewayState !== 'open') {
      return
    }

    let cancelled = false

    const pull = async () => {
      try {
        if (active) {
          try {
            const meta = await requestGateway<PetInfoMeta>('pet.info.meta', { profile: petProfile() })

            if (cancelled || !meta) {
              return
            }

            if (!meta.enabled) {
              setPetInfo({ enabled: false })

              return
            }

            if (samePetRevision($petInfo.get(), meta)) {
              return
            }
          } catch {
            // Older gateways may not have pet.info.meta yet; fall back to pet.info.
          }
        }

        const next = await requestGateway<PetInfo>('pet.info', { profile: petProfile() })

        if (!cancelled && next) {
          const current = $petInfo.get()

          if (
            next.enabled &&
            current.enabled &&
            current.slug === next.slug &&
            current.displayName === next.displayName &&
            current.scale === next.scale &&
            current.spritesheetRevision &&
            current.spritesheetRevision === next.spritesheetRevision
          ) {
            return
          }

          setPetInfo(next)
        }
      } catch {
        // cosmetic feature — never surface gateway errors
      }
    }

    void pull()
    const timer = window.setInterval(() => void pull(), active ? PET_ACTIVE_REFRESH_MS : PET_POLL_MS)
    window.addEventListener('focus', pull)

    return () => {
      cancelled = true
      window.removeEventListener('focus', pull)
      window.clearInterval(timer)
    }
  }, [gatewayState, active, requestGateway])

  // Reset pet info when the active profile changes
  const prevProfileRef = useRef(petProfile())
  useEffect(() => {
    const profile = petProfile()
    if (profile !== prevProfileRef.current) {
      prevProfileRef.current = profile
      setPetInfo({ enabled: false })
      resetPetGallery()
    }
  })

  // Wire the overlay control channel once, in the primary window.
  useEffect(() => {
    return initPetOverlayBridge()
  }, [])

  // Returning to the app clears the pet's "new message" hint.
  useEffect(() => {
    const onFocus = () => clearPetUnread()
    window.addEventListener('focus', onFocus)

    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Restore a popped-out pet on boot, once the pet has loaded.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || !active) {
      return
    }

    restoredRef.current = true
    restorePetOverlay()
  }, [active])

  // Never strand or crop the pet: re-clamp (and persist) whenever the viewport
  // shrinks or the pet's own size changes (wheel/slider).
  useEffect(() => {
    const reclamp = () =>
      setPosition(prev => {
        const next = clamp(prev)

        if (next.x === prev.x && next.y === prev.y) {
          return prev
        }

        persistString(POSITION_KEY, JSON.stringify(next))

        return next
      })

    reclamp()
    window.addEventListener('resize', reclamp)

    return () => window.removeEventListener('resize', reclamp)
  }, [clamp])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current

    if (!el) {
      return
    }

    const rect = el.getBoundingClientRect()

    // Shift-click pops the pet out into a free-floating desktop overlay.
    if (e.shiftKey) {
      popOutPet({ height: rect.height, width: rect.width, x: rect.left, y: rect.top })

      return
    }

    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, x: rect.left, y: rect.top }
    el.setPointerCapture(e.pointerId)
    el.style.cursor = 'grabbing'
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      const el = containerRef.current

      if (!drag || !el) {
        return
      }

      const next = clamp({ x: e.clientX - drag.dx, y: e.clientY - drag.dy })
      drag.x = next.x
      drag.y = next.y
      el.style.left = `${next.x}px`
      el.style.top = `${next.y}px`

      if (spriteWrapRef.current) {
        spriteWrapRef.current.style.transform = facing(next.x, petW)
      }
    },
    [clamp, petW]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current

    if (drag) {
      dragRef.current = null
      const committed = { x: drag.x, y: drag.y }
      setPosition(committed)
      persistString(POSITION_KEY, JSON.stringify(committed))
    }

    const el = containerRef.current

    if (el) {
      el.style.cursor = 'grab'
      el.releasePointerCapture?.(e.pointerId)
    }
  }, [])

  // Alt+wheel over the pet resizes it (persisted via the same path as the
  // settings slider). Zoom toward the cursor.
  const onScale = useCallback(
    (next: number, { clientX, clientY, ratio }: PetZoomAnchor) => {
      setPetScale(requestGateway, next)
      setPosition(prev => {
        const at = clampPoint(
          clientX - (clientX - prev.x) * ratio,
          clientY - (clientY - prev.y) * ratio,
          (info.frameW ?? 192) * next,
          (info.frameH ?? 208) * next
        )

        persistString(POSITION_KEY, JSON.stringify(at))

        return at
      })
    },
    [requestGateway, info.frameW, info.frameH]
  )

  usePetZoomGesture(containerRef, onScale, active && !overlayActive)

  // Commit a roamed-to position back to React state + storage when the wander
  // loop settles.
  const commitRoamPosition = useCallback((point: Point) => {
    setPosition(point)
    persistString(POSITION_KEY, JSON.stringify(point))
  }, [])

  const isDragging = useCallback(() => dragRef.current !== null, [])

  usePetRoam({
    commit: commitRoamPosition,
    containerRef,
    enabled: roamEnabled && active && !overlayActive && atRest,
    isInteracting: isDragging,
    loopMs: info.loopMs ?? 1100,
    overlayOpen: false,
    petH,
    petW
  })

  // While roaming, drive the directional run row + mirror from the travel
  // direction; at rest, fall back to the inward-facing static mascot.
  const walk = roamWalkRow(roamDir, info.stateRows)

  // While popped out, the desktop overlay window owns the mascot — hide the
  // in-window one so there aren't two.
  if (!info.enabled || !info.spritesheetBase64 || overlayActive) {
    return null
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={containerRef}
      style={{
        cursor: 'grab',
        left: position.x,
        pointerEvents: 'auto',
        position: 'fixed',
        top: position.y,
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 60
      }}
    >
      <div
        aria-hidden
        style={{
          background: `radial-gradient(ellipse at center, rgba(0,0,0,${shadowAlpha}) 0%, rgba(0,0,0,0) 70%)`,
          bottom: -shadowH * 0.4,
          height: shadowH,
          left: '50%',
          pointerEvents: 'none',
          position: 'absolute',
          transform: 'translateX(-50%)',
          width: shadowW,
          zIndex: 0
        }}
      />
      <div
        ref={spriteWrapRef}
        style={{
          lineHeight: 0,
          position: 'relative',
          transform: roamDir !== 0 ? (walk.mirror ? 'scaleX(-1)' : 'none') : facing(position.x, petW),
          zIndex: 1
        }}
      >
        <PetSprite info={info} rowOverride={walk.row} />
      </div>
    </div>
  )
}
