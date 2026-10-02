import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5101,
    strictPort: true,
  },
  preview: {
    port: 5101,
  },
});
