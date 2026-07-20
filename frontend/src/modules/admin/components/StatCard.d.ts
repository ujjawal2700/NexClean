import { type LucideIcon } from "lucide-react";
type StatCardProps = {
    icon: LucideIcon;
    label: string;
    value: string;
    delta?: string;
    trend?: "up" | "down";
};
export declare function StatCard({ icon: Icon, label, value, delta, trend }: StatCardProps): import("react").JSX.Element;
export {};
