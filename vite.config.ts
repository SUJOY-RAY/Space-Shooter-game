import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // host:true = listen on LAN (0.0.0.0) so phones on the same Wi-Fi can
    // load the game iframe. Without this, Vite only binds localhost.
    host: true,
    port: 5101,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5101,
  },
});
