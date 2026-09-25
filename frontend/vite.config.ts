import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { appConfig } from "./src/app.config";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export default defineConfig({
  plugins: [
    react(),
    // index.html takes its title and description from src/app.config.ts.
    { name: "app-config-html", transformIndexHtml: html => html
      .replace("__APP_NAME__", escape(appConfig.brand.name))
      .replace("__APP_DESCRIPTION__", escape(appConfig.brand.description)) },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": { target: process.env.API_PROXY_TARGET || "http://127.0.0.1:8000", rewrite: path => path.replace(/^\/api/, ""), changeOrigin: false } }
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    proxy: { "/api": { target: process.env.API_PROXY_TARGET || "http://127.0.0.1:8000", rewrite: path => path.replace(/^\/api/, ""), changeOrigin: false } }
  }
});
