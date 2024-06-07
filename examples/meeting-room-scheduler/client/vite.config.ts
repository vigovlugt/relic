import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        exclude: ["@sqlite.org/sqlite-wasm"], // Required due to https://github.com/vitejs/vite/issues/8427
    },
    build: {
        target: "esnext", // Required for top level await
    },
    resolve: {
        conditions: ["typescript"],
    },
});
