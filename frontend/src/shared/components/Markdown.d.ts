/**
 * Renders Markdown into plain semantic elements (h2/p/ul/a/…). Styling comes from
 * the surrounding prose container (see StaticPageShell). Internal links (starting
 * with "/") use the SPA router; external/protocol links render as anchors.
 */
export declare function Markdown({ children }: {
    children: string;
}): import("react").JSX.Element;
