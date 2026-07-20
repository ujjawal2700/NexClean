import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@shared/lib/utils";
const LOGO_SRC = "/logo.png";
/** NexClean brand mark. Single source image at /public/logo.png, swap there to rebrand. */
export function Logo({ variant = "full", className }) {
    if (variant === "mark") {
        return (_jsx("img", { src: LOGO_SRC, alt: "NexClean", className: cn("size-[2.9em] rounded-[0.5em] object-cover", className) }));
    }
    return (_jsx("img", { src: LOGO_SRC, alt: "NexClean", className: cn("h-[5em] w-auto object-contain", className) }));
}
