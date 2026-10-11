import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_TEMKA_");
  const url = env.VITE_TEMKA_SUPABASE_URL || "";
  const key = env.VITE_TEMKA_SUPABASE_ANON_KEY || "";
  if (url || key) {
    let publicKey = /^sb_publishable_[\w-]+$/.test(key);
    try { publicKey ||= JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString()).role === "anon"; } catch { /* not a legacy anon key */ }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || !publicKey) {
      throw new Error("Invalid Temka online configuration. Use the project HTTPS URL and ONLY a publishable/anon key. Never use service_role or sb_secret keys. Values are not printed.");
    }
  }
  return {
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  };
});
