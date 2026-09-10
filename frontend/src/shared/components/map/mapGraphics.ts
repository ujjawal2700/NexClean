import type { LatLng } from "@shared/lib/maps";

/**
 * Marker artwork, built as data URIs.
 *
 * Google's classic `Marker` can only rotate a `Symbol`, not an image, so the
 * agent's heading is baked into the SVG's own transform and the URI is rebuilt
 * whenever the direction changes meaningfully. That also keeps the two markers
 * visually consistent — both are our own drawings rather than one custom pin
 * next to a stock red teardrop.
 */

const svgUri = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

/** The customer's service pin — where the car actually is. */
export function destinationIconUri(): string {
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="68" viewBox="0 0 56 68">
      <ellipse cx="28" cy="62" rx="10" ry="4" fill="rgba(26,31,54,0.18)"/>
      <path d="M28 4C17.5 4 9 12.5 9 23c0 13.5 15.6 28.4 18.1 30.7a1.4 1.4 0 0 0 1.8 0C31.4 51.4 47 36.5 47 23 47 12.5 38.5 4 28 4z" fill="#1a1f36"/>
      <circle cx="28" cy="22.5" r="12" fill="#ffffff" opacity="0.12"/>
      <path d="M28 13.5l9 7.2V32a1.5 1.5 0 0 1-1.5 1.5h-5.2v-7h-4.6v7H20.5A1.5 1.5 0 0 1 19 32V20.7z" fill="#ffffff"/>
    </svg>
  `);
}

/** The cleaner, pointed the way they are travelling. */
export function agentIconUri(headingDeg: number | null): string {
  const rotation = headingDeg == null ? 0 : Math.round(headingDeg);
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="19" fill="#4f7cff" opacity="0.16"/>
      <circle cx="28" cy="28" r="13" fill="#ffffff"/>
      <circle cx="28" cy="28" r="13" fill="none" stroke="#4f7cff" stroke-width="2"/>
      <g transform="rotate(${rotation} 28 28)">
        <path d="M28 19.5l6.2 13.8a1 1 0 0 1-1.4 1.3L28 31.9l-4.8 2.7a1 1 0 0 1-1.4-1.3z" fill="#4f7cff"/>
      </g>
    </svg>
  `);
}

/** Where the cleaner started, so the travelled portion of the trip reads. */
export function originDotUri(): string {
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="6" fill="#ffffff" stroke="#70798b" stroke-width="2"/>
    </svg>
  `);
}

/** A pin for one of many agents on the admin fleet map. */
export function fleetIconUri(active: boolean): string {
  const fill = active ? "#00c2ff" : "#70798b";
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="${fill}" opacity="0.18"/>
      <circle cx="20" cy="20" r="9" fill="#ffffff" stroke="${fill}" stroke-width="2"/>
      <circle cx="20" cy="20" r="4" fill="${fill}"/>
    </svg>
  `);
}

export type MapBoundsInput = (LatLng | null | undefined)[];
