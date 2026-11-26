import { ImageResponse } from "next/og";

export const alt = "PitchSwipe: Test your pitch. Then build.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand hexes from scripts/brand/mark.mjs (ImageResponse cannot read CSS variables).
const INK = "#111111";
const LIME = "#c8f35e";
const CREAM = "#f6efe4";
const SKY = "#6ea2fd";
const CORAL = "#ff8a66";

/** The card character, the same shapes as cardsSvg() in scripts/brand/mark.mjs, cropped to the drawing. */
function Cards({ width }: { width: number }) {
  return (
    <svg width={width} height={(width * 82) / 68} viewBox="16 8 68 82">
      <rect x="24" y="14" width="46" height="62" rx="11" fill={SKY} stroke={INK} strokeWidth="3" transform="rotate(-12 47 45)" />
      <g transform="rotate(8 52 50)">
        <rect x="28" y="18" width="48" height="64" rx="12" fill={CREAM} stroke={INK} strokeWidth="3" />
        <circle cx="44" cy="45" r="3.2" fill={INK} />
        <circle cx="60" cy="45" r="3.2" fill={INK} />
        <circle cx="38.5" cy="53" r="3.4" fill={CORAL} opacity="0.85" />
        <circle cx="65.5" cy="53" r="3.4" fill={CORAL} opacity="0.85" />
        <path d="M45 54 q7 7 14 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path
          d="M52 74 c-3.2 -2.6 -6 -4.4 -6 -7.2 c0 -1.9 1.4 -3.2 3.1 -3.2 c1.3 0 2.3 0.8 2.9 1.8 c0.6 -1 1.6 -1.8 2.9 -1.8 c1.7 0 3.1 1.3 3.1 3.2 c0 2.8 -2.8 4.6 -6 7.2z"
          fill={INK}
        />
      </g>
    </svg>
  );
}

/** Site-wide 1200x630 share image: black canvas, the headline, and the card character on a lime tile. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#000000",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Cards width={56} />
            <div style={{ fontSize: 40, fontWeight: 800, color: "#f5f4f7", letterSpacing: -1 }}>PitchSwipe</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            <div style={{ fontSize: 92, fontWeight: 800, color: "#f5f4f7", letterSpacing: -3, lineHeight: 1 }}>Test your pitch.</div>
            <div style={{ display: "flex", marginTop: 12 }}>
              <div
                style={{
                  fontSize: 92,
                  fontWeight: 800,
                  color: "#f5f4f7",
                  letterSpacing: -3,
                  lineHeight: 1,
                  borderBottom: `16px solid ${LIME}`,
                  paddingBottom: 4,
                }}
              >
                Then build.
              </div>
            </div>
          </div>
          <div style={{ fontSize: 30, color: "#a3a1ab", marginTop: 36, lineHeight: 1.3 }}>
            A/B test one thing on your pitch card. Real people swipe.
          </div>
        </div>

        <div
          style={{
            width: 420,
            height: 480,
            borderRadius: 48,
            background: LIME,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Cards width={290} />
        </div>
      </div>
    ),
    size,
  );
}
