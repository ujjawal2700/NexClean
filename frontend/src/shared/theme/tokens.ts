/**
 * Design tokens mirrored as JS constants.
 * Use these where CSS variables can't reach — e.g. <canvas> particles,
 * chart libraries, or inline style calculations. Keep in sync with theme.css.
 */
export const colors = {
  bg: "#f7f9fc",
  surface: "#ffffff",
  surfaceMuted: "#eef2fb",
  ink: "#1a1f36",
  inkSoft: "#424b6b",
  muted: "#70798b",
  primary: "#4f7cff",
  primarySoft: "#6ea8ff",
  accent: "#00c2ff",
  line: "#e4eaf5",
} as const;

export const easing = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};

export const fonts = {
  display: '"Clash Display", ui-sans-serif, system-ui, sans-serif',
  sans: '"Satoshi", ui-sans-serif, system-ui, sans-serif',
} as const;
