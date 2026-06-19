import { motion } from "motion/react";

type Bar = { label: string; value: number };

/** Lightweight CSS/SVG-free bar chart — no charting dependency. */
export function BarChart({ data, format }: { data: Bar[]; format?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-48 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${(d.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="group relative w-full rounded-t-lg bg-gradient-to-t from-primary to-accent"
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-ink opacity-0 transition-opacity group-hover:opacity-100">
                {format ? format(d.value) : d.value}
              </span>
            </motion.div>
          </div>
          <span className="text-xs text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
