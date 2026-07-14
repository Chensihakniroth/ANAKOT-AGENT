import { cn } from '@/lib/utils'

// Brand badge: "AK" monogram on a dark rounded tile.
// Inline SVG — zero network requests, no file dependencies.
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md',
        className
      )}
      {...props}
    >
      <svg viewBox="0 0 28 28" className="size-full" aria-hidden="true">
        <rect width="28" height="28" rx="5" fill="#0f172a" />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="#82aaff"
          fontSize="14"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          letterSpacing="-0.5"
        >
          AK
        </text>
      </svg>
    </span>
  )
}
