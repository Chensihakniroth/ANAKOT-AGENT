import { useStore } from '@nanostores/react'
import { $backgroundOpacity } from '@/store/background'

export function ShaderBackground() {
  const opacity = useStore($backgroundOpacity)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"
      style={{ opacity: opacity ?? 0.4 }}
    >
      <style>{`
        .shader-bg {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .shader-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          animation: shader-float 12s ease-in-out infinite;
        }
        .shader-blob-1 {
          width: 30vmax;
          height: 30vmax;
          background: var(--theme-primary, #0053fd);
          top: -5vmax;
          left: -5vmax;
          animation-delay: 0s;
          opacity: 0.6;
        }
        .shader-blob-2 {
          width: 25vmax;
          height: 25vmax;
          background: var(--dt-primary, #0053fd);
          bottom: -5vmax;
          right: -5vmax;
          animation-delay: -4s;
          opacity: 0.5;
        }
        .shader-blob-3 {
          width: 20vmax;
          height: 20vmax;
          background: var(--dt-primary-foreground, #fcfcfc);
          top: 30%;
          left: 50%;
          transform: translateX(-50%);
          animation-delay: -7s;
          opacity: 0.4;
        }
        .shader-blob-4 {
          width: 15vmax;
          height: 15vmax;
          background: var(--theme-primary, #0053fd);
          opacity: 0.35;
          bottom: 20%;
          left: 10%;
          animation-delay: -2s;
          filter: blur(80px);
        }
        @keyframes shader-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(4vmax, -3vmax) scale(1.15); }
          50% { transform: translate(-2vmax, 3vmax) scale(0.9); }
          75% { transform: translate(3vmax, 1vmax) scale(1.1); }
        }
      `}</style>

      <div className="shader-bg">
        <div className="shader-blob shader-blob-1" />
        <div className="shader-blob shader-blob-2" />
        <div className="shader-blob shader-blob-3" />
        <div className="shader-blob shader-blob-4" />
      </div>
    </div>
  )
}
