import { jsx as _jsx } from "react/jsx-runtime";
import {} from "react";
import { motion } from "motion/react";
import { easing } from "@shared/theme/tokens";
/**
 * Scroll-into-view reveal for any block. Fades + lifts on enter.
 * Use <RevealGroup> to stagger a set of children.
 */
export function Reveal({ children, className, delay = 0, y = 24, once = true }) {
    return (_jsx(motion.div, { className: className, initial: { opacity: 0, y }, whileInView: { opacity: 1, y: 0 }, viewport: { once, margin: "-12% 0px -12% 0px" }, transition: { duration: 0.8, delay, ease: easing.outExpo }, children: children }));
}
const groupVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const itemVariants = {
    hidden: { opacity: 0, y: 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easing.outExpo } },
};
export function RevealGroup({ children, className }) {
    return (_jsx(motion.div, { className: className, variants: groupVariants, initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-10% 0px -10% 0px" }, children: children }));
}
export function RevealItem({ children, className }) {
    return (_jsx(motion.div, { className: className, variants: itemVariants, children: children }));
}
