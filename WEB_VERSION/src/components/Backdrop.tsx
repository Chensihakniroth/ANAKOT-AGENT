import { useStore } from '@nanostores/react'
import { type CSSProperties } from 'react'

import { $backgroundImage, $backgroundOpacity, $backgroundPositionX, $backgroundPositionY, $backgroundSize, $backgroundType } from '@/store/background'
import { ShaderBackground } from '@/components/ui/shader-background'

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
] as const

type BlendMode = (typeof BLEND_MODES)[number]
const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

export function Backdrop() {
  const bgImage = useStore($backgroundImage)
  const bgOpacity = useStore($backgroundOpacity)
  const bgPosX = useStore($backgroundPositionX)
  const bgPosY = useStore($backgroundPositionY)
  const bgSize = useStore($backgroundSize)

  // Resolve the image URL: if it's a data URL or absolute URL use as-is,
  // otherwise prepend BASE_URL for relative paths like "ds-assets/filler-bg0.jpg"
  const resolvedSrc = bgImage
    ? (/^https?:\/\//.test(bgImage) || bgImage.startsWith('file:///') || bgImage.startsWith('data:')
        ? bgImage
        : assetPath(bgImage))
    : assetPath('ds-assets/filler-bg0.jpg')

  const statue = {
    enabled: true,
    opacity: 0.025,
    blendMode: 'difference' as BlendMode,
    invert: true,
    saturate: 1,
    brightness: 1,
    objectPosition: 'top left',
    scale: 160,
  }

  const bgType = useStore($backgroundType)

  return (
    <>
      {bgType === 'shader' ? (
        <ShaderBackground />
      ) : statue.enabled && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-2"
          style={{
            mixBlendMode: statue.blendMode as CSSProperties['mixBlendMode'],
            opacity: bgOpacity ?? statue.opacity
          }}
        >
          <img
            alt=""
            className="w-auto min-w-dvw object-cover"
            fetchPriority="low"
            src={resolvedSrc}
            style={{
              height: `${statue.scale}dvh`,
              objectPosition: `${bgPosX}% ${bgPosY}%`,
              objectFit: bgSize as CSSProperties['objectFit'],
              filter: `invert(calc(${statue.invert ? 1 : 0} * var(--backdrop-invert-mul, 1))) saturate(${statue.saturate}) brightness(${statue.brightness})`
            }}
          />
        </div>
      )}
    </>
  )
}
