import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@modules": path.resolve(__dirname, "./src/modules"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy libraries into cacheable vendor chunks so the main
        // app bundle stays small and unchanged deploys re-use cached vendors.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("gsap")) return "gsap";
          if (id.includes("/motion/") || id.includes("framer-motion")) return "motion";
          if (id.includes("react-router") || id.includes("/react-router-dom/")) return "router";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/"))
            return "react";
          // jsPDF (and its runtime deps, pulled in transitively for its
          // unused SVG/canvas support) is only reached via a dynamic
          // import() in the receipt generator — keep them out of the eager
          // vendor bundle so visitors who never download a receipt don't
          // pay for it upfront.
          const JSPDF_DEPS = [
            "jspdf", "canvg", "core-js", "css-line-break", "dompurify", "fast-png", "fflate",
            "rgbcolor", "svg-pathdata", "html2canvas", "stackblur-canvas", "pako", "iobuffer",
          ];
          if (JSPDF_DEPS.some((dep) => id.includes(`/node_modules/${dep}/`))) return;
          // Only small libraries every screen uses share the eager vendor
          // chunk. Everything else (xlsx for admin exports, react-markdown,
          // Google Maps, socket.io…) is left to Rollup so it lands in the lazy
          // chunk that actually imports it. A catch-all "vendor" here used to
          // pull ~750 kB — mostly the admin-only xlsx — into every page load.
          const EAGER_SHARED = [
            "@tanstack", "zustand", "clsx", "tailwind-merge", "class-variance-authority",
            "@radix-ui", "lucide-react",
          ];
          if (EAGER_SHARED.some((dep) => id.includes(`/node_modules/${dep}/`))) return "vendor";
        },
      },
    },
  },
});
