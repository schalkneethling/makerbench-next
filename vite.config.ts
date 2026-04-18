import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { varlockVitePlugin } from "@varlock/vite-integration";

// https://vite.dev/config/
export default defineConfig({
  plugins: [varlockVitePlugin(), react()],
});
