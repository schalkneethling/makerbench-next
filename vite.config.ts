import { defineConfig } from "vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { varlockVitePlugin } from "@varlock/vite-integration";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    varlockVitePlugin(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
