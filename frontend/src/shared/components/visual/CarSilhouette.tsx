import { cn } from "@shared/lib/utils";

export type CarType = "hatchback" | "sedan" | "suv" | "luxury" | "premium";

type CarSilhouetteProps = {
  type?: CarType;
  className?: string;
  /** unique id base to avoid gradient collisions when many render */
  uid?: string;
};

type CarShape = {
  body: string;
  glass: string;
  wheels: [number, number];
  wheelR: number;
};

/**
 * Premium side-profile car silhouettes, one distinct shape per vehicle type.
 * Drawn in SVG (flat-illustration style) so we never depend on photography.
 * viewBox: 0 0 220 104 · front faces right · wheels overlaid at the base.
 */
const SHAPES: Record<CarType, CarShape> = {
  hatchback: {
    body:
      "M16 84 L16 62 C16 56 20 53 26 52 L42 51 L52 36 C55 33 59 31 65 31 L126 31 " +
      "C137 31 143 35 149 44 L165 56 L188 59 C196 60 200 64 200 70 L200 84 Z",
    glass:
      "M60 37 L100 37 L100 51 L56 51 Z M106 37 L126 37 C133 37 137 40 141 46 L145 51 L106 51 Z",
    wheels: [52, 158],
    wheelR: 15,
  },
  sedan: {
    body:
      "M12 84 L12 66 C12 60 16 57 22 56 L46 53 L66 40 C70 36 76 35 84 35 L132 35 " +
      "C142 35 148 39 154 47 L168 58 L196 61 C205 62 210 65 210 71 L210 84 Z",
    glass:
      "M68 41 L102 41 L102 53 L58 53 Z M108 41 L132 41 C139 41 143 44 148 50 L152 53 L108 53 Z",
    wheels: [54, 168],
    wheelR: 15,
  },
  suv: {
    body:
      "M14 84 L14 64 C14 58 18 55 24 54 L42 52 L52 35 C55 31 59 29 65 29 L150 29 " +
      "C159 29 165 33 169 42 L181 54 L199 57 C207 58 211 62 211 68 L211 84 Z",
    glass:
      "M58 35 L104 35 L104 50 L56 50 Z M110 35 L150 35 L164 50 L110 50 Z",
    wheels: [56, 168],
    wheelR: 17,
  },
  luxury: {
    body:
      "M10 84 L10 70 C10 63 14 60 20 59 L50 56 L82 43 C88 39 96 38 106 38 L142 38 " +
      "C155 38 163 42 171 52 L191 62 L207 64 C213 65 215 68 215 73 L215 84 Z",
    glass: "M80 45 L138 45 C149 45 155 48 161 55 L62 55 Z",
    wheels: [56, 174],
    wheelR: 16,
  },
  premium: {
    body:
      "M8 84 L8 73 L20 72 L23 65 C23 61 27 59 33 58 L54 56 L80 46 C88 42 98 40 110 40 " +
      "L134 40 C148 40 158 43 167 53 L193 62 L209 64 C213 65 215 68 215 73 L215 84 Z",
    glass: "M88 47 L150 47 C157 47 161 49 166 54 L66 54 Z",
    wheels: [56, 174],
    wheelR: 16,
  },
};

export function CarSilhouette({ type = "sedan", className, uid = "car" }: CarSilhouetteProps) {
  const shape = SHAPES[type];
  const gid = `${uid}-${type}-grad`;
  const sid = `${uid}-${type}-shine`;

  return (
    <svg viewBox="0 0 220 104" className={cn("h-auto w-full", className)} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="20" y1="28" x2="200" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EA8FF" />
          <stop offset="0.55" stopColor="#4F7CFF" />
          <stop offset="1" stopColor="#3D63E0" />
        </linearGradient>
        <linearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#DCEBFF" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="112" cy="99" rx="96" ry="5" fill="#1A1F36" opacity="0.08" />

      {/* body */}
      <path d={shape.body} fill={`url(#${gid})`} />
      {/* subtle top highlight */}
      <path d={shape.body} fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />
      {/* glass */}
      <path d={shape.glass} fill={`url(#${sid})`} />

      {/* wheels */}
      {shape.wheels.map((cx, i) => (
        <g key={i}>
          <circle cx={cx} cy="82" r={shape.wheelR} fill="#1A1F36" />
          <circle cx={cx} cy="82" r={shape.wheelR * 0.52} fill="#ffffff" />
          <circle cx={cx} cy="82" r={shape.wheelR * 0.2} fill="#1A1F36" />
        </g>
      ))}
    </svg>
  );
}
