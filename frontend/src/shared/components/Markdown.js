import { jsx as _jsx } from "react/jsx-runtime";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
/**
 * Renders Markdown into plain semantic elements (h2/p/ul/a/…). Styling comes from
 * the surrounding prose container (see StaticPageShell). Internal links (starting
 * with "/") use the SPA router; external/protocol links render as anchors.
 */
export function Markdown({ children }) {
    return (_jsx(ReactMarkdown, { components: {
            a: ({ href, children }) => href && href.startsWith("/") ? (_jsx(Link, { to: href, children: children })) : (_jsx("a", { href: href, target: href?.startsWith("http") ? "_blank" : undefined, rel: "noreferrer", children: children })),
        }, children: children }));
}
