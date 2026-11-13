import QRCode from 'qrcode'
import { useMemo } from 'react'

/** A QR code drawn as SVG in the current text color, so it follows the design tokens. */
export function QrCode({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const { n, cells } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const count = qr.modules.size
    const dark: [number, number][] = []
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.modules.get(r, c)) dark.push([c, r])
    return { n: count, cells: dark }
  }, [value])
  const quiet = 2
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`${-quiet} ${-quiet} ${n + 2 * quiet} ${n + 2 * quiet}`} className="text-ink">
      <rect x={-quiet} y={-quiet} width={n + 2 * quiet} height={n + 2 * quiet} className="fill-surface" />
      <path d={cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('')} fill="currentColor" shapeRendering="crispEdges" />
    </svg>
  )
}
