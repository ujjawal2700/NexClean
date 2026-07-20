/**
 * Design tokens mirrored as JS constants.
 * Use these where CSS variables can't reach — e.g. <canvas> particles,
 * chart libraries, or inline style calculations. Keep in sync with theme.css.
 */
export declare const colors: {
    readonly bg: "#f7f9fc";
    readonly surface: "#ffffff";
    readonly surfaceMuted: "#eef2fb";
    readonly ink: "#1a1f36";
    readonly inkSoft: "#424b6b";
    readonly muted: "#70798b";
    readonly primary: "#4f7cff";
    readonly primarySoft: "#6ea8ff";
    readonly accent: "#00c2ff";
    readonly line: "#e4eaf5";
};
export declare const easing: {
    outExpo: readonly [0.16, 1, 0.3, 1];
    spring: readonly [0.34, 1.56, 0.64, 1];
};
export declare const fonts: {
    readonly display: "\"Clash Display\", ui-sans-serif, system-ui, sans-serif";
    readonly sans: "\"Satoshi\", ui-sans-serif, system-ui, sans-serif";
};
