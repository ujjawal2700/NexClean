/**
 * Navigates to a landing-page section (e.g. "#plans") whether the user is
 * already on "/" (smooth-scrolls in place) or on another route (routes home
 * first, then HomeHashScroll picks up the hash once the section mounts).
 */
export declare function useSectionLink(): (hash: string) => void;
