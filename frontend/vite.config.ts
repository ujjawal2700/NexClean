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
          return "vendor";
        },
      },
    },
  },
});
