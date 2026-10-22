import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const browserOnly = (process.env.VITE_STATIC ?? env.VITE_STATIC) === "true";
  return {
    // FastAPI remains rooted at /. Only the Pages build uses the repository path.
    base: browserOnly ? "/AI-Research-Assistant/" : "/",
    server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  };
});
