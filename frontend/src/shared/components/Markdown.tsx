import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";

/**
 * Renders Markdown into plain semantic elements (h2/p/ul/a/…). Styling comes from
 * the surrounding prose container (see StaticPageShell). Internal links (starting
 * with "/") use the SPA router; external/protocol links render as anchors.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) =>
          href && href.startsWith("/") ? (
            <Link to={href}>{children}</Link>
          ) : (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {children}
            </a>
          ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
