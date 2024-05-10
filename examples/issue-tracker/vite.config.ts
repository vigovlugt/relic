import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), TanStackRouterVite()],
    optimizeDeps: {
        exclude: ["@sqlite.org/sqlite-wasm"], // Required due to https://github.com/vitejs/vite/issues/8427
    },
    build: {
        target: "esnext", // Only required for top level await
    },
});
