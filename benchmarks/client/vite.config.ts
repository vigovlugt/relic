import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        exclude: ["@sqlite.org/sqlite-wasm"], // Required due to https://github.com/vitejs/vite/issues/8427
    },
    resolve: {
        conditions: ["typescript"],
    },
});
