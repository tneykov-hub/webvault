import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mobileRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(mobileRoot, "..");

export default defineConfig({
  root: mobileRoot,
  publicDir: resolve(projectRoot, "public"),
  plugins: [react()],
  resolve: {
    alias: [
      { find: "next/link", replacement: resolve(mobileRoot, "src/next-link.tsx") },
      { find: "@", replacement: projectRoot },
    ],
  },
  build: {
    outDir: resolve(projectRoot, "mobile-web"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
  },
});
