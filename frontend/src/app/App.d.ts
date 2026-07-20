/**
 * Root application shell: server-state provider + router + smooth scrolling.
 * The top-level boundary only catches crashes outside the customer/agent/admin
 * modules (e.g. marketing pages) — each module has its own inner boundary.
 */
export declare function App(): import("react").JSX.Element;
