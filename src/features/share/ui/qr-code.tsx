import { encodeQr, qrPath } from "@/features/share/qr";

/** QR code as inline SVG (pure TS encoder in src/features/share/qr.ts; no dependency). Includes the 4-module quiet zone. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const qr = encodeQr(value);
  const border = 4;
  const total = qr.size + border * 2;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges" className={className}>
      <rect width={total} height={total} fill="#ffffff" />
      <path d={qrPath(qr, border)} fill="#0a0a0a" />
    </svg>
  );
}
