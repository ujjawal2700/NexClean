import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { Clock, ArrowUpRight } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";
const VEHICLES = [
    { name: "Hatchback", type: "hatchback", price: "₹299", duration: "~45 min" },
    { name: "Sedan", type: "sedan", price: "₹399", duration: "~60 min" },
    { name: "SUV", type: "suv", price: "₹499", duration: "~75 min", featured: true },
    { name: "Luxury", type: "luxury", price: "₹699", duration: "~90 min" },
    { name: "Premium", type: "premium", price: "Custom", duration: "~120 min" },
];
function VehicleCard({ vehicle, uid }) {
    const ref = useRef(null);
    const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
    const onMove = (e) => {
        const el = ref.current;
        if (!el)
            return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setTilt({ rx: -py * 8, ry: px * 10 });
    };
    const reset = () => setTilt({ rx: 0, ry: 0 });
    return (_jsx("div", { ref: ref, onMouseMove: onMove, onMouseLeave: reset, className: "group relative h-full [perspective:1000px]", children: _jsxs("div", { className: "flex h-full flex-col rounded-card border border-line bg-surface/70 p-6 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-2 group-hover:shadow-[var(--shadow-lift)]", style: { transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transformStyle: "preserve-3d" }, children: [vehicle.featured && (_jsx("span", { className: "absolute right-5 top-5 rounded-pill bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-medium text-white", children: "Popular" })), _jsx("div", { className: "grid h-24 place-items-center", style: { transform: "translateZ(40px)" }, children: _jsx(CarSilhouette, { uid: uid, type: vehicle.type, className: "max-w-[85%] transition-transform duration-500 group-hover:scale-110" }) }), _jsx("h3", { className: "mt-4 font-display text-xl font-semibold text-ink", children: vehicle.name }), _jsxs("div", { className: "mt-2 flex items-center gap-2 text-sm text-muted", children: [_jsx(Clock, { className: "size-4" }), " ", vehicle.duration] }), _jsxs("div", { className: "mt-auto flex items-end justify-between pt-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted", children: "Starting at" }), _jsx("p", { className: "font-display text-2xl font-semibold text-ink", children: vehicle.price })] }), _jsx("span", { className: "grid size-10 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white", children: _jsx(ArrowUpRight, { className: "size-5" }) })] })] }) }));
}
export function VehicleCategories() {
    const { vehicleCategories: c } = useSiteContent().landing;
    return (_jsxs(Section, { id: "vehicles", className: "border-t border-line/60", children: [_jsx(SectionHeading, { eyebrow: c.eyebrow, title: c.title, subtitle: c.subtitle }), _jsx(RevealGroup, { className: "mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", children: VEHICLES.map((v, i) => (_jsx(RevealItem, { children: _jsx(VehicleCard, { vehicle: v, uid: `veh-${i}` }) }, v.name))) })] }));
}
