import { type ReactNode } from "react";
/** Redirects to the agent login when there's no auth token, role is invalid, or token expired. */
export declare function ProtectedRoute({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
