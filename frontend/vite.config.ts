import { defineConfig } from "vite";

// Development forwards API requests; production serves assets from FastAPI.
export default defineConfig({
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
