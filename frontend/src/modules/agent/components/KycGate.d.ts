import { type ReactNode } from "react";
/**
 * Sits between auth and the full agent dashboard. New signups land in
 * "pending" until admin approves their KYC; suspended agents are locked out
 * of jobs entirely. Both get a status screen instead of the dashboard chrome.
 */
export declare function KycGate({ children }: {
    children: ReactNode;
}): import("react").JSX.Element | null;
