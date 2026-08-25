import { BLACK, GOLD_DAY, GOLD_NIGHT, MODE_DEFAULTS } from './constants'
import { clamp } from './geometry'
import type { Palette, Rgb } from './types'

// Theme tokens come through `color-mix()`/oklch, so getComputedStyle returns a
// non-rgb() string. Rasterize through a 1x1 canvas to get real sRGB bytes —
// naive string parsing of oklab()/color(srgb …) silently yields black.
let _probe: CanvasRenderingContext2D | null = null

export function resolveRgb(color: string): Rgb {
  if (!_probe) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    _probe = c.getContext('2d', { willReadFrequently: true })
  }

  if (!_probe) {
    return { b: 184, g: 163, r: 148 }
  }

  _probe.clearRect(0, 0, 1, 1)
  _probe.fillStyle = '#888888'
  _probe.fillStyle = color
  _probe.fillRect(0, 0, 1, 1)
  const d = _probe.getImageData(0, 0, 1, 1).data

  return { b: d[2], g: d[1], r: d[0] }
}

export function rgba(c: Rgb, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const p = clamp(t, 0, 1)

  return {
    b: Math.round(a.b + (b.b - a.b) * p),
    g: Math.round(a.g + (b.g - a.g) * p),
    r: Math.round(a.r + (b.r - a.r) * p)
  }
}

export function darken(c: Rgb, amount: number): Rgb {
  return mixRgb(c, BLACK, amount)
}

export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.114 * b) / 255
}

function rgbToHsl(c: Rgb): [number, number, number] {
  const r = c.r / 255
  const g = c.g / 255
  const b = c.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0

  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60
  }

  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2

  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x]

  return { b: Math.round((b + m) * 255), g: Math.round((g + m) * 255), r: Math.round((r + m) * 255) }
}

// Memory ink: naga-jade — hue-locked to ~168° (the serpent's gem tone) so
// memories always read as jade against the gold structure, whatever the skin's
// primary. Muted toward the overlay background just enough to stay quiet
// (fake alpha) without sinking into it.
export function memoryInkFor(primary: Rgb, bg: Rgb): Rgb {
  const [, s, l] = rgbToHsl(primary)
  const jade = hslToRgb(168, Math.max(s * 0.9, 0.42), clamp(l, 0.52, 0.7))

  return mixRgb(jade, bg, 0.3)
}

// Resolve the theme-derived palette once per theme change — the resolveRgb probe
// does a getImageData readback, so this stays out of the per-frame path. Node
// groups borrow restrained tint from the theme; structure stays foreground ink.
export function computePalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas)
  const fg = resolveRgb(style.color)
  const darkTheme = luminance(fg.r, fg.g, fg.b) > 0.55
  const base: Rgb = darkTheme ? { b: 255, g: 255, r: 255 } : { b: 0, g: 0, r: 0 }
  const primary = resolveRgb(style.getPropertyValue('--theme-primary').trim() || style.color)

  const bg = resolveRgb(
    style.getPropertyValue('--background').trim() ||
      style.getPropertyValue('--dt-background').trim() ||
      (darkTheme ? '#000' : '#fff')
  )

  // Fixed gold-leaf accent — the gilding that ties the ceiling together.
  const gold = darkTheme ? GOLD_NIGHT : GOLD_DAY

  return {
    // Band tint derives from the gilding so the inter-ring shells read as warm
    // sandstone washes in both modes.
    bandInk: gold,
    base,
    bg,
    c: MODE_DEFAULTS[darkTheme ? 'dark' : 'light'],
    chipBg: darkTheme ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.85)',
    darkTheme,
    gold,
    inkInv: darkTheme ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)',
    memoryInk: memoryInkFor(primary, bg),
    primary,
    // Skill orbs burn as golden lamps — mixed a touch toward base so they sit
    // IN the scene instead of glaring.
    skillInk: mixRgb(gold, base, darkTheme ? 0.06 : 0.14)
  }
}
